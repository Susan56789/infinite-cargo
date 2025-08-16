# Infinite Cargo Web Application

Infinite Cargo is a full-stack web application built with React.js on the frontend and MongoDB as the database. It offers logistics and cargo management services including shipment tracking, driver support, and cargo-related assistance.

---

## 🚀 Features

- Shipment Tracking Interface
- Cargo & Driver Support Pages
- Privacy Policy, Terms, Cookie Policy
- MongoDB integration for data persistence
- Inline CSS for fast styling and deployment

---

## 🧱 Tech Stack

| Layer        | Technology               |
|--------------|--------------------------|
| Frontend     | React.js, CSS     |
| Backend      | Node.js / Express.js     |
| Database     | MongoDB                  |
| Hosting      | Vercel / Render / MongoDB Atlas |

---

## 🛠️ Setup Instructions

### 1. Clone Repository

```bash
git clone https://github.com/your-username/infinite-cargo.git
cd infinite-cargo
```

### 2. Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

### 3. Set Up MongoDB

- Create a MongoDB Atlas account or install MongoDB locally.
- Create a new cluster and database called `infinitecargo`.
- Add your IP to the whitelist and create a database user.

### 4. Configure Environment Variables

Create a `.env` file in the backend folder:

```env
PORT=5000
MONGODB_URI=mongodb+srv://cargo_user:your_password@cluster0.mongodb.net/infinitecargo?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret
```

### 5. Run App

```bash
# Backend
cd backend
npm run dev

# Frontend (in new terminal)
cd frontend
npm start
```

---

## 📁 Folder Structure

```
infinite-cargo/
├── backend/
│   ├── routes/
│   ├── controllers/
│   └── server.js
│
├── frontend/
│   ├── components/
│   ├── pages/
│   └── App.js
```

---

## 📞 Contact

- Email: <support@infinitecargo.co.ke>
- Phone: +254 722 483468
- Website: [https://infinitecargo.co.ke](https://infinitecargo.co.ke)

---

## 📄 License

This project is licensed under the MIT License.
