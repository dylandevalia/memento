export const helloRoutes = {
  "/api/hello": {
    async GET(_req: Request) {
      return Response.json({
        message: "Hello, world!",
        method: "GET",
      });
    },
    async PUT(_req: Request) {
      return Response.json({
        message: "Hello, world!",
        method: "PUT",
      });
    },
  },

  "/api/hello/:name": async (
    req: Request & { params: Record<string, string> },
  ) => {
    const name = req.params.name;
    return Response.json({
      message: `Hello, ${name}!`,
    });
  },
};
