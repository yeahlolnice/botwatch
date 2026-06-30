export const createRoleQuery = `
    CREATE TYPE IF NOT EXISTS role_type AS ENUM('admin', 'user');
`;

export const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role role_type NOT NULL DEFAULT 'user',
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

// Widen password column to 255 for bcrypt hashes on existing installs
export const migrateUsersTableQuery = `
    ALTER TABLE users ALTER COLUMN password TYPE VARCHAR(255);
`;

// Never return password in list/detail queries
export const getAllUsersQuery = `
    SELECT id, name, email, role, last_login, created_at, updated_at FROM users ORDER BY created_at DESC;
`;

export const getUserByIdQuery = `
    SELECT id, name, email, role, last_login, created_at, updated_at FROM users WHERE id = $1;
`;

export const createUserQuery = `
    INSERT INTO users (name, email, password, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, email, role;
`;

export const updateUserQuery = `
    UPDATE users
    SET name = $1,
        email = $2,
        password = $3,
        role = $4,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING id, name, email, role;
`;

export const deleteUserQuery = `
    DELETE FROM users WHERE id = $1;
`;
