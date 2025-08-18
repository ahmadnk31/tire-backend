"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    try {
        const all = await index_1.db.select().from(schema_1.banners).where((0, drizzle_orm_1.eq)(schema_1.banners.isActive, true)).orderBy((0, drizzle_orm_1.asc)(schema_1.banners.sortOrder));
        res.json({ banners: all });
    }
    catch (err) {
        res.status(500).json({ error: "Failed to fetch banners" });
    }
});
router.post("/", async (req, res) => {
    try {
        const { type, src, headline, subheadline, description, sortOrder, isActive } = req.body;
        const [created] = await index_1.db.insert(schema_1.banners).values({
            type,
            src,
            headline,
            subheadline,
            description,
            sortOrder,
            isActive,
        }).returning();
        res.status(201).json({ banner: created });
    }
    catch (err) {
        res.status(500).json({ error: "Failed to create banner" });
    }
});
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { type, src, headline, subheadline, description, sortOrder, isActive } = req.body;
        const [updated] = await index_1.db.update(schema_1.banners)
            .set({ type, src, headline, subheadline, description, sortOrder, isActive })
            .where((0, drizzle_orm_1.eq)(schema_1.banners.id, Number(id)))
            .returning();
        res.json({ banner: updated });
    }
    catch (err) {
        res.status(500).json({ error: "Failed to update banner" });
    }
});
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await index_1.db.delete(schema_1.banners).where((0, drizzle_orm_1.eq)(schema_1.banners.id, Number(id)));
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: "Failed to delete banner" });
    }
});
exports.default = router;
