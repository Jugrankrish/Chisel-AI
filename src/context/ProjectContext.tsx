import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface UploadedFile {
  path: string;
  name: string;
  size: number;
}

interface ProjectContextType {
  projectName: string;
  setProjectName: (name: string) => void;
  resetProject: () => void;
  uploadId: number;
  uploadedFiles: UploadedFile[];
  addUploadedFile: (file: UploadedFile) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectName, setProjectName] = useState("Project Alpha");
  const [uploadId, setUploadId] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const resetProject = () => {
    setProjectName("New Project");
    setUploadId(prev => prev + 1);
    setUploadedFiles([]);
  };

  const addUploadedFile = (file: UploadedFile) => {
    setUploadedFiles(prev => [...prev, file]);
  };

  return (
    <ProjectContext.Provider value={{ projectName, setProjectName, resetProject, uploadId, uploadedFiles, addUploadedFile }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
