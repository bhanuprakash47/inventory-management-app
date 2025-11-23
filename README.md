Inventory Management System 📦

A full-stack inventory tracking application built with the MERN stack architecture (using SQLite for simplicity). This application allows businesses to manage stock, track history, and perform bulk operations via CSV.

🚀 Features

Dashboard: Real-time overview of all products with search and filtering.

CRUD Operations: Create, Read, Update, and Delete inventory items.

Inventory History: Automatically tracks stock changes (Old vs. New quantity) with timestamps.

Bulk Import: Upload .csv files to add hundreds of products at once.

Export: Download your entire inventory as a CSV file.

Stock Alerts: Visual indicators for items that are "Out of Stock".

Responsive Design: Clean, human-friendly UI using standard CSS and Flexbox.

🛠️ Tech Stack

Frontend (Client)

React.js: UI Library

Axios: API Request handling

Lucide React: Modern icons

CSS3: Custom Flexbox styling (No heavy frameworks)

Backend (Server)

Node.js & Express: Server-side logic

SQLite3: Lightweight, file-based relational database

Multer: File upload handling

CSV-Parser: Stream-based CSV processing

📂 Folder Structure

inventory-management-app/
├── backend/
│   ├── inventory.db        # SQLite Database file
│   ├── server.js           # Main API server entry point
│   ├── uploads/            # Temp storage for CSV uploads
│   └── package.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.js          # Main React Application
│   │   ├── App.css         # Custom Styling
│   │   └── index.js
│   └── package.json
│
└── README.md


⚙️ Installation & Setup

Follow these steps to run the project locally.

1. Clone the Repository

git clone [https://github.com/bhanuprakash47/inventory-management-app.git](https://github.com/bhanuprakash47/inventory-management-app.git)
cd inventory-management-app


2. Setup Backend

cd backend
npm install
node server.js


The server will start on http://localhost:3000 and automatically create the inventory.db database.

3. Setup Frontend

Open a new terminal:

cd frontend
npm install
npm start


The application will open at http://localhost:3000 (or the port configured by React).

📡 API Endpoints

Method

Endpoint

Description

GET

/api/products

Fetch all products (supports ?category= filter)

GET

/api/products/search

Search products by name (?name=query)

POST

/api/products

Add a single new product

PUT

/api/products/:id

Update product details & log history

POST

/api/products/import

Bulk upload via CSV file

GET

/api/products/export

Download inventory as CSV

GET

/api/products/:id/history

View stock change logs for a product

📝 CSV Import Format

To bulk import products, your CSV file must match this header format:

name,unit,category,brand,stock,status,image
Milk,Packet,Dairy,Amul,50,active,url_here
Rice,Kg,Grains,Daawat,100,active,url_here


