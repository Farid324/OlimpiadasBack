<p align="center">
  <a href="https://nestjs.com/" target="_blank">
    <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" />
  </a>
</p>

<p align="center">
  Sistema backend desarrollado con <a href="https://nodejs.org" target="_blank">Node.js</a> y
  <a href="https://nestjs.com/" target="_blank">NestJS</a> para la gestión de olimpíadas científicas.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Backend-NestJS-red" />
  <img src="https://img.shields.io/badge/ORM-Prisma-blue" />
  <img src="https://img.shields.io/badge/DB-PostgreSQL-lightgrey" />
  <img src="https://img.shields.io/badge/Language-TypeScript-blue" />
</p>

---

# Sistema de Gestión de Olimpíadas Científicas – Oh! Sansi 2025

## Descripción

Este proyecto corresponde al **backend del Sistema de Gestión de Olimpíadas Científicas Oh! Sansi 2025**, desarrollado para administrar de forma integral el proceso de organización, evaluación y publicación de resultados de olimpíadas académicas.

El sistema permite gestionar **olimpistas, responsables de área, evaluadores, fases de competencia, calificaciones y medalleros**, proporcionando un flujo estructurado y seguro para cada rol involucrado.  
El proyecto está desarrollado considerando el **contexto académico y organizacional boliviano**.

---

## Funcionalidades principales

- Registro y gestión de olimpistas  
- Gestión de responsables de área  
- Gestión de evaluadores  
- Control de fases (clasificatoria y final)  
- Registro y administración de calificaciones  
- Generación de resultados y medallero  
- Control de accesos por roles  
- Registro de cambios y reportes  

---

## Roles del sistema

- **Administrador**: gestión general del sistema y configuración global  
- **Responsable de Área**: gestión de olimpistas, evaluadores y control de fases  
- **Evaluador**: registro de notas y evaluación de olimpistas  

---

## Tecnologías utilizadas

- **NestJS** – Framework backend progresivo para Node.js  
- **TypeScript** – Tipado estático para mayor mantenibilidad  
- **Prisma ORM** – Gestión de base de datos y modelos  
- **PostgreSQL** – Base de datos relacional  
- **PNPM** – Gestor de dependencias  
- **JWT** – Autenticación y autorización  

---

## Estructura general del proyecto

El proyecto sigue una arquitectura modular basada en NestJS, separando responsabilidades por dominios como usuarios, responsables, evaluadores, olimpistas, fases y reportes, facilitando la escalabilidad y el mantenimiento del sistema.

---

## Instalación del proyecto

```bash
pnpm install

Compilación y ejecución
bash

Copiar código
# modo desarrollo
pnpm run start

# modo desarrollo con recarga automática
pnpm run start:dev

# modo producción
pnpm run start:prod

Pruebas
bash

Copiar código
# pruebas unitarias
pnpm run test

# pruebas end-to-end
pnpm run test:e2e

# cobertura de pruebas
pnpm run test:



Para desplegar la aplicación en un entorno de producción, se recomienda seguir las buenas prácticas establecidas por NestJS.
Más información en la documentación oficial:

 https://docs.nestjs.com/deployment

Contexto académico
Este proyecto fue desarrollado como parte de la materia Taller de Ingeniería de Software, aplicando conceptos de:

Arquitectura de software

Gestión de roles y permisos

Desarrollo backend con NestJS

Persistencia de datos

Buenas prácticas de desarrollo y pruebas

Recursos
Documentación oficial de NestJS: https://docs.nestjs.com

Prisma ORM: https://www.prisma.io/docs

PostgreSQL: https://www.postgresql.org/docs

Licencia
Este proyecto se distribuye bajo la licencia MIT.