# canteen-service

Route-by-route reference for `routes/recipes.js`.

TODO: Document the remaining routes.

## The recipe object

Every recipe read returns the same shape, assembled by `recipeProjection` and finished by `formatRecipe`.
Clients work with this object whole: it carries the recipe, its author, its tags, and its ingredients already grouped and ordered.

```jsonc
{
  "id": 1,
  "author_id": 1,
  "title": "Classic Pancakes",
  "description": "Fluffy homemade pancakes.",
  "instructions": "1. Mix dry ingredients.\n2. ...",
  "prep_time_minutes": 10,
  "cook_time_minutes": 15,
  "wait_time_minutes": 0,
  "total_time_minutes": 25,          // derived from the three above
  "servings": 4,
  "created_at": "...",
  "updated_at": "...",
  "like_count": 3,                   // denormalized onto recipes

  "author": { "id": 1, "username": "crymall" },   // null once the author is deleted
  "tags": [{ "id": 1, "name": "Breakfast" }],
  "liked_by_current_user": false,                 // false for anonymous readers

  "ingredient_groups": [
    {
      "id": 6,
      "name": "Main",
      "position": 0,
      "ingredients": [
        {
          "id": 103,                 // the recipe_ingredients row
          "ingredient_id": 1,        // the shared ingredients row
          "name": "All-Purpose Flour",
          "quantity": 1.5,
          "unit": "cup",
          "notes": null,
          "position": 0,
          "display_name": "All-Purpose Flour",
          "display_unit": "cups"     // inflected for this quantity
        }
      ]
    }
  ]
}
```

Groups and ingredients arrive sorted by `position`.

`name`/`unit` are the stored values and are what a form edits and sends back.
`display_name`/`display_unit` are inflected for the row's quantity and are what a page renders.
A quantity above one pluralizes the unit, or the ingredient name when there is no unit; the members of `UNIT_SYMBOLS_NEVER_PLURALIZED` stay as written, per [NIST SP 811](https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-6-rules-and-style-conventions-printing-and-using).

`unit` measures the ingredient. A size or preparation qualifier is a note: `1 Tomato (large)` is `quantity: 1, unit: null, notes: "large"`.

## GET routes

All four are readable anonymously.
`optionalAuth` reads the cookie when one is present, which is what makes `liked_by_current_user` meaningful.
The three list routes take `limit` (capped at 50) and `offset`.

| Route | Purpose | Notes |
| --- | --- | --- |
| `GET /recipes` | Search and browse | Filters: `title` (partial), `ids`, `tags`, `ingredients` (comma-separated; a recipe must match **all** given tags/ingredients), `feed=following\|friends` |
| `GET /recipes/popular` | Home page | Ordered by `like_count` |
| `GET /recipes/user/:userId` | Profile page | |
| `GET /recipes/:id` | Detail and edit load | `404` when absent |

`feed` requires a signed-in caller and answers `401` otherwise.
Lists order by `created_at DESC, id DESC` — `popular` by `like_count DESC, id DESC` — with the id tiebreaker keeping pagination from repeating or skipping a row.

## POST /recipes

Creates a whole recipe — scalars, tags, and the full ingredient tree — in one transaction, and answers `201` with the created row.
Requires `write:data`.

```jsonc
{
  "title": "Buttermilk Pancakes",
  "instructions": "Step 1: ...",
  "servings": 4,
  "prep_time_minutes": 10,
  "tags": [3, 7],                    // tag ids
  "ingredient_groups": [
    { "name": "Main", "ingredients": [
        { "id": 12, "quantity": 2, "unit": "cup", "notes": "sifted" }
    ]}
  ]
}
```

Array order carries position; sending an explicit `position` has no effect.
`ingredients[].id` is the ingredient id — the server assigns the `recipe_ingredients` and `recipe_ingredient_groups` row ids.
An ingredient may repeat within a group when its notes distinguish it.

| Status | Cause |
| --- | --- |
| `400` | `title` or `instructions` missing; `ingredient_groups` missing, or a group list without a `Main` group; two groups sharing a name; `tags`, `ingredient_groups`, or a group's `ingredients` not an array |
| `403` | the caller has no row in this service's `users` table |

## PUT /recipes/:id

Applies an edited recipe graph in one transaction and answers `200` with the recipe object above, so a client can seed its cache from the response.
Requires `write:data`, and the author gate lives in the `UPDATE ... WHERE author_id = ...` that opens the transaction.

Takes the same body as `POST`, and expresses every ingredient and tag change as a different graph: adding, removing, renaming, reordering, and moving between groups are all just the new arrays.

Scalars are replaced from the body on every call.
Collections follow the key:

- present → replaced wholesale (`tags: []` clears the tags)
- absent → left as they are

| Status | Cause |
| --- | --- |
| `400` | as `POST`, except that omitting `ingredient_groups` is allowed and leaves the groups alone |
| `404` | no such recipe, or the caller is not its author |

Payload validation runs before the transaction opens, so a `400` costs no queries.

## Ingredient groups

Every recipe keeps a group named `Main` for its ungrouped ingredients, and every submitted group list contains one.
Group names are unique within a recipe and are how a submitted group matches an existing one, since row ids are the server's and change on each write.

`SortableGroup.jsx` in midden-hub mirrors this by rendering the `Main` name as static text with no Remove button.

## Likes and delete

| Route | Purpose | Errors |
| --- | --- | --- |
| `POST /recipes/:id/likes` | Like; idempotent | `404` when the user or recipe is missing |
| `DELETE /recipes/:id/likes` | Unlike | `404` when no like exists |
| `DELETE /recipes/:id` | Delete a recipe | `404` when absent or not the caller's |

All three require `write:data`.
