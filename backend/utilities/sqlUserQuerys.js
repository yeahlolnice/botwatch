
export const createRoleQuery = `
    CREATE TYPE role_type AS ENUM('admin', 'user');
`;

export const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, 
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        role role_type NOT NULL DEFAULT 'user',
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

export const getAllUsersQuery = `
    SELECT * FROM users;
`;

export const getUserByIdQuery =`
    SELECT * FROM users WHERE id = $1;
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
