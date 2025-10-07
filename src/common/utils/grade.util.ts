// src/common/utils/grade.util.ts

/** Nivel y grado escolar de un competidor (olimpista o miembro de grupo) */

export type NivelCompetidor = 'Primaria' | 'Secundaria';

export function parseGradoEscolar(input: string): {
  nivel: NivelCompetidor;
  grado: number;
} {
  const clean = input.trim().replace(/\s+/g, '').toUpperCase();
  const m = clean.match(/^([1-6])(?:º|°|o)?([PS])$/);
  if (!m) throw new Error(`Formato inválido de gradoEscolar: "${input}"`);
  const grado = Number(m[1]);
  const nivel: NivelCompetidor = m[2] === 'P' ? 'Primaria' : 'Secundaria';
  return { nivel, grado };
}

export function resolveNivelYGrado(opts: {
  nivelCompetidor?: NivelCompetidor;
  grado?: number;
  gradoEscolar?: string;
  grupoNivelString?: string;
}): { nivel?: NivelCompetidor; grado?: number } {
  if (opts.nivelCompetidor && opts.grado) {
    if (opts.grado < 1 || opts.grado > 6)
      throw new Error('grado fuera de rango (1..6)');
    return { nivel: opts.nivelCompetidor, grado: opts.grado };
  }
  if (opts.gradoEscolar) {
    return parseGradoEscolar(opts.gradoEscolar);
  }
  if (opts.grupoNivelString) {
    return parseGradoEscolar(opts.grupoNivelString);
  }
  return {};
}
