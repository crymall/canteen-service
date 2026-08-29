# canteen-service

Express + PostgreSQL backend for Canteen, the recipe app.
Routes live in `routes/`, migrations in `db/migrations/` (node-pg-migrate), and the seeded baseline in `db/legacy/`.
Tests are jest + supertest in `routes/__tests__/`, with `config/db` mocked — they assert SQL and call order rather than hitting a database.

## Recipe writes

`POST /recipes` and `PUT /recipes/:id` both accept the whole recipe graph and apply it in a single transaction.
There are no per-ingredient, per-tag, or per-group endpoints; adding, removing, renaming, moving and reordering are all expressed as a different graph in the body.

```jsonc
{
  "title": "Buttermilk Pancakes",       // required
  "instructions": "Step 1: ...",        // required
  "description": null,
  "prep_time_minutes": 10,
  "cook_time_minutes": 15,
  "wait_time_minutes": null,
  "servings": 4,

  "tags": [3, 7],                       // tag ids

  "ingredient_groups": [
    { "name": "Batter", "ingredients": [
        { "id": 12, "quantity": 2, "unit": "cup", "notes": "sifted" }
    ]}
  ]
}
```

Array order carries position, so neither groups nor ingredients take an explicit `position`.
`ingredients[].id` is the **ingredient** id; the `recipe_ingredients` and `recipe_ingredient_groups` row ids are owned by the server and are neither read from the body nor stable across writes.
The response is the full recipe graph — the same projection and pluralization `GET /recipes/:id` returns — so a client can seed its cache from the response instead of re-fetching.

### Stored values vs. display values

Units are stored in their canonical **singular** form, normalized on write by `canonicalUnit` — the same treatment `POST /ingredients` already gives ingredient names via `pluralize.singular`.
Rows predating this normalize themselves on their next save.

Inflection for display happens on read, where the quantity lives, and `formatRecipe` exposes it as **`display_unit` and `display_name`** alongside the untouched stored `unit` and `name`.

That separation is load-bearing, not cosmetic.
The edit form seeds its inputs from `unit`/`name` and posts them straight back, and every save rewrites every ingredient row — so if inflection overwrote the stored values, a save that changed nothing would persist `tbsp` as `tbsps`.
Render `display_*`; round-trip the raw fields.

`UNIT_SYMBOLS_NEVER_PLURALIZED` (`g`, `oz`, `ml`, `tbsp`, …) is consulted on both read and write.
[NIST SP 811](https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-6-rules-and-style-conventions-printing-and-using) is explicit that unit symbols are unaltered in the plural — `75 cm`, never `75 cms`.
Any other unit is a spelled-out name and inflects normally above a quantity of one (`2 cups`), which is the same NIST rule for spelled-out names.
With no unit at all, the ingredient is what gets counted (`2 Apples`).

**`unit` holds units, and nothing else.**
A size or preparation qualifier is not a unit and belongs in `notes`, alongside the `softened` and `halved` already there: `1 Tomato (large)` is `quantity: 1, unit: null, notes: "large"`.
Nothing in the code accommodates a descriptor in the unit field — put `large` there and it inflects to `larges` like any other unrecognized word.

Note that display quantity is fixed per row today. Should adjustable servings or an aggregating shopping list ever land, the displayed quantity would change without a write — which is precisely why inflection must not migrate onto the stored value.

### Collection semantics

Scalars are replaced wholesale: `PUT` writes every scalar column from the body, and `title` and `instructions` are `NOT NULL`, so both are required.
Collections are different, because a missing key would otherwise destroy rows the caller never mentioned:

- key present → that collection is replaced wholesale
- key absent → the existing rows stand

`tags: []` clears the tags.
`ingredient_groups: []` is refused whenever the recipe has a `Main` group, for the reason below.

### The `Main` group

`Main` is the bucket ungrouped ingredients fall into.
It may not be renamed or removed, so a payload that omits it from a recipe that has one is a `400` — and that is why an empty `ingredient_groups` array is refused too.
`SortableGroup.jsx` in midden-hub enforces the same rule in the UI by rendering the name as static text and omitting the Remove button; the server check exists so the invariant does not depend on the client.

A recipe that never had a `Main` group (every group custom-named) is free to stay that way.

### Why replacement rather than a diff

Nothing outside `recipe_ingredients` and `recipe_ingredient_groups` references their row ids — `recipe_likes`, `recipe_tags`, `list_recipes` and `messages` all key on `recipes.id`.
Deleting and reinserting is therefore invisible to every other reader, and it gives renames, moves, reorders, adds and removes one code path instead of five reconciliation branches.
The cost is that those row ids churn on every save.

### Errors

| Status | Cause |
| --- | --- |
| `400` | missing `title` or `instructions`; non-array `tags`, `ingredient_groups` or `ingredients`; duplicate group name; dropping an existing `Main` group |
| `404` | the recipe does not exist, or the caller is not its author |

Payload validation runs before the transaction opens; the `Main` check runs inside it, after the ownership gate, so it cannot be used to probe recipes the caller does not own.

`unique_recipe_group_name (recipe_id, name)` backs the group-name rule.
Delete-then-insert inside one transaction never collides with it, but a payload naming two groups the same would — hence the up-front validation, so it surfaces as a `400` rather than a constraint violation escaping as a `500`.

The same ingredient **may** appear more than once in a group, distinguished by its notes — `2 Eggs (beaten)` alongside `1 Egg (separated)`.
`unique_group_ingredient` used to forbid that; `1780000000004_allow-repeated-ingredients-in-a-group` drops it, because replace-everything writes give it nothing left to protect.
The ingredient filter on `GET /recipes` counts `DISTINCT ri.ingredient_id`, so repeats do not skew matching.
