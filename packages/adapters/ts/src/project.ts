import { Project, ScriptTarget, ModuleKind, ModuleResolutionKind } from "ts-morph";
import { join } from "node:path";

export function createProject(projectRoot: string, files: string[]): Project {
  const proj = new Project({
    compilerOptions: {
      target: ScriptTarget.ESNext,
      module: ModuleKind.ESNext,
      // Node10 (legacy "node") resolution is permissive: extension-less
      // imports like `import { X } from "./foo"` resolve to foo.ts/.tsx.
      // NodeNext would require explicit .js extensions in source.
      moduleResolution: ModuleResolutionKind.Node10,
      jsx: 4 /* Preserve */,
      allowJs: true,
      checkJs: false,
      noEmit: true,
      strict: false,
    },
    skipFileDependencyResolution: true,
    useInMemoryFileSystem: false,
  });
  for (const f of files) {
    proj.addSourceFileAtPathIfExists(join(projectRoot, f));
  }
  return proj;
}
