// src/utils/name.util.ts

/**
 * Divide un nombre completo en nombres y apellidos.
 * Si hay más de dos palabras, las dos últimas son apellidos.
 * Ejemplos:
 * - "Juan Pérez" => { nombres: "Juan", apellidos: "Pérez" }
 * - "María Luisa Gómez Fernández" => { nombres: "María Luisa", apellidos: "Gómez Fernández" }
 * @param full Nombre completo a dividir
 * @returns Objeto con propiedades `nombres` y `apellidos`
 */

export function splitNombreCompleto(full: string): {
  nombres: string;
  apellidos: string;
} {
  const norm = full.trim().replace(/\s+/g, ' ');
  const parts = norm.split(' ');
  if (parts.length === 1) return { nombres: parts[0], apellidos: '' };
  const apellidos = parts.slice(-2).join(' ');
  const nombres = parts.slice(0, -2).join(' ');
  return { nombres, apellidos };
}
