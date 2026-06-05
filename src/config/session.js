import dotenv from "dotenv";
dotenv.config();

import session from "express-session";
import MongoStore from "connect-mongo";

export default session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
  }),
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 3,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' // 👈 Mencegah serangan CSRF
  },
});
