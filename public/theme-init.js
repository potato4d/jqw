(() => {
  let storedTheme;
  try {
    storedTheme = window.localStorage.getItem("jqw-theme");
  } catch {
    storedTheme = undefined;
  }
  const theme =
    storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
})();
