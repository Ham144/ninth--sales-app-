import projects from "./projects.json";

export const howtoDocs = projects.map((project) => ({
  id: project.id,
  title: project.title,
  summary: project.description,
  stage: project.stage,
  url: project.url,
  features: project.features || [],
  technologies: project.technologies || [],
}));
