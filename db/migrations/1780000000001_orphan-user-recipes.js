exports.up = (pgm) => {
  // recipes.author_id
  pgm.dropConstraint('recipes', 'recipes_author_id_fkey');
  pgm.addConstraint('recipes', 'recipes_author_id_fkey', {
    foreignKeys: {
      columns: 'author_id',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
  });

  // messages.sender_id
  pgm.dropConstraint('messages', 'messages_sender_id_fkey');
  pgm.addConstraint('messages', 'messages_sender_id_fkey', {
    foreignKeys: {
      columns: 'sender_id',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
  });

  // messages.receiver_id
  pgm.dropConstraint('messages', 'messages_receiver_id_fkey');
  pgm.addConstraint('messages', 'messages_receiver_id_fkey', {
    foreignKeys: {
      columns: 'receiver_id',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
  });
};

exports.down = (pgm) => {
  // Restoring NO ACTION / CASCADE
  pgm.dropConstraint('recipes', 'recipes_author_id_fkey');
  pgm.addConstraint('recipes', 'recipes_author_id_fkey', {
    foreignKeys: {
      columns: 'author_id',
      references: 'users(id)',
    },
  });

  pgm.dropConstraint('messages', 'messages_sender_id_fkey');
  pgm.addConstraint('messages', 'messages_sender_id_fkey', {
    foreignKeys: {
      columns: 'sender_id',
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
  });

  pgm.dropConstraint('messages', 'messages_receiver_id_fkey');
  pgm.addConstraint('messages', 'messages_receiver_id_fkey', {
    foreignKeys: {
      columns: 'receiver_id',
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
  });
};
