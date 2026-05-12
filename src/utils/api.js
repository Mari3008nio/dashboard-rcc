export const fetchSeguro = async (url, options = {}) => {
  const token = localStorage.getItem("rcc_token");
  if (!options.headers) options.headers = {};
  if (token) options.headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(url, options);
  if (response.status === 401) {
    alert(
      "Tu sesión ha expirado o es inválida. Por favor, inicia sesión de nuevo.",
    );
    localStorage.removeItem("rcc_token");
    window.location.reload();
    throw new Error("No autorizado");
  }
  return response;
};
