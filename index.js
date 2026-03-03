import app from "./app.js";

const PORT = 3500;

app.listen(PORT, (error) => {
  if (error) {
    console.log(`error server: ${error}`);
  } else {
    console.log(`Server is running on http://localhost:${PORT}`);
  }
});
