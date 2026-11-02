
    def test_memory_routes_are_registered(self):
        paths = app.openapi()["paths"]

        memories_path = paths.get("/api/memories", {})
        memory_item_path = paths.get(
            "/api/memories/{memory_id}",
            {},
        )

        self.assertIn("get", memories_path)
        self.assertIn("post", memories_path)
        self.assertIn("patch", memory_item_path)
        self.assertIn("delete", memory_item_path)
