// src/common/utils/name.util.ts
// Normaliza espacios: quita dobles, trim a extremos
function normalizeSpaces(s: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Divide un nombre completo en { nombres, apellidos } con las reglas:
 * - 2 palabras: 1ª nombre, 2ª apellido
 * - 3 palabras: 1ª nombre, 2 últimas apellidos
 * - 4 palabras: 2 primeras nombres, 2 últimas apellidos
 * - 1 palabra: todo a nombres
 * - >4 palabras: todas menos las 2 últimas => nombres; 2 últimas => apellidos
 */
export function splitNombreCompleto(fullname: string): { nombres: string; apellidos: string } {
  const clean = normalizeSpaces(fullname).replace(/[^\p{L}\s.'-]/gu, "");
  if (!clean) return { nombres: "", apellidos: "" };

  const parts = clean.split(" ").filter(Boolean);
  const n = parts.length;

  if (n === 1) {
    return { nombres: parts[0], apellidos: "" };
  }
  if (n === 2) {
    return { nombres: parts[0], apellidos: parts[1] };
  }
  if (n === 3) {
    return { nombres: parts[0], apellidos: parts.slice(1).join(" ") };
  }
  if (n === 4) {
    return { nombres: parts.slice(0, 2).join(" "), apellidos: parts.slice(2).join(" ") };
  }

  // n > 4: razonable en Bolivia (nombres compuestos + apellidos compuestos)
  return {
    nombres: parts.slice(0, -2).join(" "),
    apellidos: parts.slice(-2).join(" "),
  };
}
