import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { StoreContext, useStoreProvider } from "./store";
import App from "./App.jsx";

function Root() {
  const store = useStoreProvider();
  return (
    <StoreContext.Provider value={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StoreContext.Provider>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
