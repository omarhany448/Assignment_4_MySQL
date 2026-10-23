const express = require("express");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
app.use(express.json());

let pool;


// 1. Create database and configure MySQL connection pool

async function initializeDatabase() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    });

    await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``
    );
    await connection.end();

    pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    await pool.query(`
        CREATE TABLE IF NOT EXISTS Suppliers (
            SupplierID INT PRIMARY KEY AUTO_INCREMENT,
            SupplierName VARCHAR(100) NOT NULL,
            ContactNumber VARCHAR(15)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS Products (
            ProductID INT PRIMARY KEY AUTO_INCREMENT,
            ProductName VARCHAR(100) NOT NULL,
            Price DECIMAL(10,2) NOT NULL,
            StockQuantity INT NOT NULL,
            SupplierID INT,
            FOREIGN KEY (SupplierID)
                REFERENCES Suppliers(SupplierID)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS Sales (
            SaleID INT PRIMARY KEY AUTO_INCREMENT,
            ProductID INT NOT NULL,
            QuantitySold INT NOT NULL,
            SaleDate DATE NOT NULL,
            FOREIGN KEY (ProductID)
                REFERENCES Products(ProductID)
        )
    `);
}

const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// 2. PRODUCTS CRUD

app.post("/api/products", asyncHandler(async (req, res) => {
    const { ProductName, Price, StockQuantity, SupplierID } = req.body;

    const [result] = await pool.execute(
        `INSERT INTO Products
        (ProductName, Price, StockQuantity, SupplierID)
        VALUES (?, ?, ?, ?)`,
        [ProductName, Price, StockQuantity, SupplierID ?? null]
    );

    res.status(201).json({
        message: "Product created",
        ProductID: result.insertId
    });
}));

app.get("/api/products", asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`
        SELECT p.*, s.SupplierName
        FROM Products p
        LEFT JOIN Suppliers s ON p.SupplierID = s.SupplierID
    `);

    res.json(rows);
}));

app.get("/api/products/:id", asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
        "SELECT * FROM Products WHERE ProductID = ?",
        [req.params.id]
    );

    if (!rows.length)
        return res.status(404).json({ message: "Product not found" });

    res.json(rows[0]);
}));

app.put("/api/products/:id", asyncHandler(async (req, res) => {
    const { ProductName, Price, StockQuantity, SupplierID } = req.body;

    const [result] = await pool.execute(
        `UPDATE Products
         SET ProductName = ?, Price = ?, StockQuantity = ?, SupplierID = ?
         WHERE ProductID = ?`,
        [ProductName, Price, StockQuantity, SupplierID ?? null, req.params.id]
    );

    if (!result.affectedRows)
        return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product updated" });
}));

app.delete("/api/products/:id", asyncHandler(async (req, res) => {
    const [result] = await pool.execute(
        "DELETE FROM Products WHERE ProductID = ?",
        [req.params.id]
    );

    if (!result.affectedRows)
        return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product deleted" });
}));

// 3. SUPPLIERS CRUD

app.post("/api/suppliers", asyncHandler(async (req, res) => {
    const { SupplierName, ContactNumber } = req.body;

    const [result] = await pool.execute(
        `INSERT INTO Suppliers (SupplierName, ContactNumber)
         VALUES (?, ?)`,
        [SupplierName, ContactNumber]
    );

    res.status(201).json({
        message: "Supplier created",
        SupplierID: result.insertId
    });
}));

app.get("/api/suppliers", asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM Suppliers");
    res.json(rows);
}));

app.put("/api/suppliers/:id", asyncHandler(async (req, res) => {
    const { SupplierName, ContactNumber } = req.body;

    const [result] = await pool.execute(
        `UPDATE Suppliers
         SET SupplierName = ?, ContactNumber = ?
         WHERE SupplierID = ?`,
        [SupplierName, ContactNumber, req.params.id]
    );

    if (!result.affectedRows)
        return res.status(404).json({ message: "Supplier not found" });

    res.json({ message: "Supplier updated" });
}));

app.delete("/api/suppliers/:id", asyncHandler(async (req, res) => {
    const [result] = await pool.execute(
        "DELETE FROM Suppliers WHERE SupplierID = ?",
        [req.params.id]
    );

    if (!result.affectedRows)
        return res.status(404).json({ message: "Supplier not found" });

    res.json({ message: "Supplier deleted" });
}));

// 4. SALES

app.post("/api/sales", asyncHandler(async (req, res) => {
    const { ProductID, QuantitySold, SaleDate } = req.body;

    const [result] = await pool.execute(
        `INSERT INTO Sales (ProductID, QuantitySold, SaleDate)
         VALUES (?, ?, ?)`,
        [ProductID, QuantitySold, SaleDate]
    );

    res.status(201).json({
        message: "Sale recorded",
        SaleID: result.insertId
    });
}));

app.get("/api/sales", asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM Sales");
    res.json(rows);
}));

app.get("/api/sales/product/:id", asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
        "SELECT * FROM Sales WHERE ProductID = ?",
        [req.params.id]
    );

    res.json(rows);
}));

// 5. DATABASE MODIFICATIONS

app.post("/api/db/add-category", asyncHandler(async (req, res) => {
    await pool.query(
        "ALTER TABLE Products ADD COLUMN Category VARCHAR(100)"
    );
    res.json({ message: "Category column added" });
}));

app.delete("/api/db/remove-category", asyncHandler(async (req, res) => {
    await pool.query(
        "ALTER TABLE Products DROP COLUMN Category"
    );
    res.json({ message: "Category column removed" });
}));

app.patch("/api/db/contact-number-length", asyncHandler(async (req, res) => {
    await pool.query(`
        ALTER TABLE Suppliers
        MODIFY COLUMN ContactNumber VARCHAR(15)
    `);
    res.json({ message: "ContactNumber changed to VARCHAR(15)" });
}));

app.patch("/api/db/product-name-not-null", asyncHandler(async (req, res) => {
    await pool.query(`
        ALTER TABLE Products
        MODIFY COLUMN ProductName VARCHAR(100) NOT NULL
    `);
    res.json({ message: "ProductName is now NOT NULL" });
}));


// 6. INSERT REQUIRED DATA
app.post("/api/seed", asyncHandler(async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        await connection.execute(
            `INSERT INTO Suppliers (SupplierName, ContactNumber)
             VALUES ('FreshFoods', '01001234567')
             ON DUPLICATE KEY UPDATE
             ContactNumber = VALUES(ContactNumber)`
        );

        const [suppliers] = await connection.execute(
            "SELECT SupplierID FROM Suppliers WHERE SupplierName = ?",
            ["FreshFoods"]
        );

        const supplierID = suppliers[0].SupplierID;

        for (const product of [
            ["Milk", 15.00, 50],
            ["Bread", 10.00, 30],
            ["Eggs", 20.00, 40]
        ]) {
            await connection.execute(
                `INSERT INTO Products
                 (ProductName, Price, StockQuantity, SupplierID)
                 SELECT ?, ?, ?, ?
                 WHERE NOT EXISTS (
                     SELECT 1 FROM Products WHERE ProductName = ?
                 )`,
                [...product, supplierID, product[0]]
            );
        }

        const [milkRows] = await connection.execute(
            "SELECT ProductID FROM Products WHERE ProductName = ?",
            ["Milk"]
        );

        const milkID = milkRows[0].ProductID;

        const [existingSales] = await connection.execute(
            `SELECT SaleID FROM Sales
             WHERE ProductID = ? AND QuantitySold = 2 AND SaleDate = ?`,
            [milkID, "2025-05-20"]
        );

        if (!existingSales.length) {
            await connection.execute(
                `INSERT INTO Sales (ProductID, QuantitySold, SaleDate)
                 VALUES (?, 2, ?)`,
                [milkID, "2025-05-20"]
            );
        }

        await connection.commit();
        res.status(201).json({ message: "Required data inserted" });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}));

// 7. Update Bread price to 25.00
app.patch("/api/products/bread/price", asyncHandler(async (req, res) => {
    const [result] = await pool.execute(
        "UPDATE Products SET Price = 25.00 WHERE ProductName = 'Bread'"
    );

    if (!result.affectedRows)
        return res.status(404).json({ message: "Bread not found" });

    res.json({ message: "Bread price updated to 25.00" });
}));

// 8. Delete Eggs
app.delete("/api/products/eggs", asyncHandler(async (req, res) => {
    const [result] = await pool.execute(
        "DELETE FROM Products WHERE ProductName = 'Eggs'"
    );

    if (!result.affectedRows)
        return res.status(404).json({ message: "Eggs not found" });

    res.json({ message: "Eggs deleted" });
}));

// 9. Total quantity sold for each product
app.get("/api/reports/total-sold", asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`
        SELECT p.ProductID, p.ProductName,
               COALESCE(SUM(s.QuantitySold), 0) AS TotalQuantitySold
        FROM Products p
        LEFT JOIN Sales s ON p.ProductID = s.ProductID
        GROUP BY p.ProductID, p.ProductName
    `);

    res.json(rows);
}));

// 10. Product with highest stock quantity
app.get("/api/reports/highest-stock", asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`
        SELECT * FROM Products
        WHERE StockQuantity = (SELECT MAX(StockQuantity) FROM Products)
    `);

    res.json(rows);
}));

// 11. Suppliers whose names start with F
app.get("/api/reports/suppliers-starting-f", asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
        "SELECT * FROM Suppliers WHERE SupplierName LIKE 'F%'"
    );

    res.json(rows);
}));

// 12. Products that have never been sold
app.get("/api/reports/never-sold", asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`
        SELECT p.*
        FROM Products p
        LEFT JOIN Sales s ON p.ProductID = s.ProductID
        WHERE s.SaleID IS NULL
    `);

    res.json(rows);
}));

// 13. All sales with product name, quantity, and sale date
app.get("/api/reports/sales-details", asyncHandler(async (req, res) => {
    const [rows] = await pool.query(`
        SELECT p.ProductName, s.QuantitySold, s.SaleDate
        FROM Sales s
        INNER JOIN Products p ON s.ProductID = p.ProductID
        ORDER BY s.SaleDate DESC
    `);

    res.json(rows);
}));

app.use((err, req, res, next) => {
    console.error(err.message);

    res.status(err.status || 500).json({
        message: err.code === "ER_DUP_FIELDNAME"
            ? "Column already exists"
            : err.code === "ER_BAD_FIELD_ERROR"
            ? "Column does not exist"
            : err.code === "ER_ROW_IS_REFERENCED_2"
            ? "Cannot delete this record because it is referenced by another record"
            : err.code === "ER_NO_REFERENCED_ROW_2"
            ? "Referenced record does not exist"
            : "Internal server error"
    });
});

initializeDatabase()
    .then(() => {
        app.listen(process.env.PORT || 3000, () => {
            console.log("Server running on port 3000");
        });
    })
    .catch((err) => {
        console.error("Database initialization failed:", err);
        process.exit(1);
    });