CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Maintenance', 'Decommissioned')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO assets (name, department, status) VALUES
('Core Router - MikroTik CCR2004', 'Networking', 'Active'),
('Database Server - Oracle Enterprise Linux', 'IT Infrastructure', 'Active'),
('Staging Web App - Ubuntu Server', 'Development', 'Maintenance'),
('Legacy Backup NAS', 'Storage', 'Decommissioned');
