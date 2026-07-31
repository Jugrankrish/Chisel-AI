<<<<<<< HEAD
import React, { createContext, useContext, useState, ReactNode } from "react";

export interface PlyFile {
  serverPath: string; // path on server disk
  name: string;
  size: number;
}

export interface PipelineStats {
  total: string;
  removed: string;
  kept: string;
  removedPct: string;
  keptPct: string;
  query: string;
  elapsed: string;
}

type JobStatus = "idle" | "running" | "done" | "error";

interface ProjectContextType {
  projectName: string;
  setProjectName: (name: string) => void;
  resetProject: () => void;

  plyFile: PlyFile | null;
  setPlyFile: (f: PlyFile | null) => void;

  currentJobId: string | null;
  setCurrentJobId: (id: string | null) => void;

  jobStatus: JobStatus;
  setJobStatus: (s: JobStatus) => void;

  pipelineStats: PipelineStats | null;
  setPipelineStats: (s: PipelineStats | null) => void;

  /** Legacy – kept so Upload page compiles without change */
  uploadId: number;
  uploadedFiles: { path: string; name: string; size: number }[];
  addUploadedFile: (file: { path: string; name: string; size: number }) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectName, setProjectName] = useState("Project Alpha");
  const [uploadId, setUploadId] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<
    { path: string; name: string; size: number }[]
  >([]);

  const [plyFile, setPlyFile] = useState<PlyFile | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);

  const resetProject = () => {
    setProjectName("New Project");
    setUploadId((p) => p + 1);
    setUploadedFiles([]);
    setPlyFile(null);
    setCurrentJobId(null);
    setJobStatus("idle");
    setPipelineStats(null);
  };

  const addUploadedFile = (file: { path: string; name: string; size: number }) => {
    setUploadedFiles((prev) => [...prev, file]);
  };

  return (
    <ProjectContext.Provider
      value={{
        projectName,
        setProjectName,
        resetProject,
        plyFile,
        setPlyFile,
        currentJobId,
        setCurrentJobId,
        jobStatus,
        setJobStatus,
        pipelineStats,
        setPipelineStats,
        uploadId,
        uploadedFiles,
        addUploadedFile,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within a ProjectProvider");
  return ctx;
}
=======
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
>>>>>>> b227557ce5afba356c3c02ab1e2c0ea08314c80c
