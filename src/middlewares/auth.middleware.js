export function authRequired(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  console.log("SESSION USER:", req.session.user); // 🔥 TAMBAH
  next();
}


export const adminOnly = (req, res, next) => {
  if (req.session.user?.role !== "admin") {
    return res.sendStatus(403);
  }
  next();
};
