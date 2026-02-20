import { Router } from "express";
import { requireAccess } from "../middleware/requireAccess.js";

export const libraryRouter = Router();

libraryRouter.get("/", requireAccess, (_req, res) => {
  return res.json({
    ok: true,
    items: [
      { id: "course_1", title: "Watercolor Basics", lessons: 12 },
      { id: "course_2", title: "Sketching 101", lessons: 8 },
    ],
    access: res.locals.access,
  });
});
