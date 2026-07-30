import React, { useState, useRef, useEffect } from "react";
import { Upload as UploadIcon, FileVideo, X, CheckCircle2, AlertCircle, Edit2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useAnalytics } from "../hooks/useAnalytics";
import { useProject } from "../context/ProjectContext";

export function Upload() {
  const { trackEvent } = useAnalytics();
  const { projectName, setProjectName, uploadId, addUploadedFile } = useProject();
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<{
    id: string;
    file: File;
    status: 'idle' | 'uploading' | 'success' | 'error';
    progress: number;
    error?: string;
  }[]>([]);
  const [globalError, setGlobalError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempProjectName, setTempProjectName] = useState(projectName);

  useEffect(() => {
    setFiles([]);
    setGlobalError("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setTempProjectName(projectName); // Ensure temp syncs with context changes
    if (projectName === "New Project") {
      setIsEditingTitle(true);
    }
  }, [uploadId, projectName]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(Array.from(e.target.files));
    }
  };

  const validateAndAddFiles = (selectedFiles: File[]) => {
    setGlobalError("");
    
    const videoFiles = selectedFiles.filter(f => f.type.startsWith('video/'));
    
    if (videoFiles.length !== selectedFiles.length) {
      setGlobalError("Some files were rejected. Please select valid video files.");
    }
    
    const validFiles = videoFiles.filter(f => f.size <= 100 * 1024 * 1024);
    
    if (validFiles.length !== videoFiles.length) {
      setGlobalError("Some files are too large. Maximum size is 100MB.");
    }
    
    if (files.length + validFiles.length > 3) {
      setGlobalError("Maximum 3 files allowed per project.");
      validFiles.splice(3 - files.length);
    }
    
    const newFiles = validFiles.map(f => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      status: 'idle' as const,
      progress: 0
    }));
    
    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      newFiles.forEach(f => {
        trackEvent('video_selected', { name: f.file.name, size: f.file.size });
      });
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUploadAll = async () => {
    const idleFiles = files.filter(f => f.status === 'idle');
    if (idleFiles.length === 0) return;
    
    idleFiles.forEach(fileObj => {
      // Start upload for each file
      uploadSingleFile(fileObj.id, fileObj.file);
    });
  };

  const uploadSingleFile = async (id: string, file: File) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'uploading', progress: 10 } : f));
    
    const formData = new FormData();
    formData.append('video', file);
    
    try {
      const progressInterval = setInterval(() => {
        setFiles(prev => prev.map(f => {
          if (f.id === id && f.status === 'uploading') {
            return { ...f, progress: Math.min(f.progress + 10, 90) };
          }
          return f;
        }));
      }, 300);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const data = await response.json();
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'success', progress: 100 } : f));
      
      // Save the uploaded file in global project context
      addUploadedFile({
        path: data.file.path,
        name: data.file.filename,
        size: data.file.size
      });

      trackEvent('video_uploaded', { fileUrl: data.file.path });
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: message } : f));
      trackEvent('video_upload_error', { error: String(error) });
    }
  };

  const isUploading = files.some(f => f.status === 'uploading');
  const hasIdle = files.some(f => f.status === 'idle');

  return (
    <div className="flex flex-col flex-1 p-6 lg:p-12 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-display-lg font-bold text-ink mb-2">Upload Video Data</h1>
        <p className="text-body-lg text-mute mb-8">
          Upload video scans for semantic processing and 3D reconstruction. Supported formats: MP4, MOV, AVI. Max 3 files.
        </p>

        <div className="mb-8 group">
          {isEditingTitle ? (
            <>
              <label className="block text-body-sm font-medium text-mute mb-2 ml-1">Project Title</label>
              <input 
                type="text" 
                autoFocus
                value={tempProjectName}
                onChange={(e) => setTempProjectName(e.target.value)}
                onBlur={() => {
                  setProjectName(tempProjectName || "Untitled Project");
                  setIsEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setProjectName(tempProjectName || "Untitled Project");
                    setIsEditingTitle(false);
                  }
                }}
                className="w-full bg-canvas-soft border-2 border-primary rounded-xl p-4 text-ink focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-bold text-[18px]"
              />
            </>
          ) : (
            <div 
              onClick={() => {
                setTempProjectName(projectName);
                setIsEditingTitle(true);
              }}
              className="flex items-center gap-3 cursor-pointer w-fit hover:bg-canvas-soft/50 px-4 py-2 rounded-lg -ml-4 transition-colors"
              title="Click to edit title"
            >
              <h2 className="text-[24px] font-bold text-primary">{projectName}</h2>
              <Edit2 size={16} className="text-mute opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>

        {globalError && (
          <div className="flex items-center gap-2 text-error bg-error-container/20 border border-error/50 rounded-lg p-3 w-full mb-6 text-[14px]">
            <AlertCircle size={18} />
            <span>{globalError}</span>
          </div>
        )}

        {files.length < 3 && (
          <div 
            className={cn(
              "relative w-full rounded-xl border-2 border-dashed p-12 flex flex-col items-center justify-center transition-all bg-canvas-soft mb-8",
              dragActive ? "border-primary bg-primary/10 shadow-[0_0_24px_rgba(34,211,238,0.15)]" : "border-hairline hover:border-hairline-soft",
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input 
              ref={inputRef}
              type="file" 
              accept="video/*" 
              multiple
              className="hidden" 
              onChange={handleChange}
              disabled={isUploading}
            />

            <div className="w-20 h-20 rounded-full bg-canvas flex items-center justify-center mb-6">
              <UploadIcon size={32} className="text-primary" />
            </div>
            <h3 className="text-headline-lg-mobile font-bold text-ink mb-2 text-center">
              Drag and drop your video(s) here
            </h3>
            <p className="text-body-sm text-mute mb-6 text-center">
              Maximum file size: 100MB. Up to {3 - files.length} more file(s) allowed.
            </p>
            <button 
              onClick={onButtonClick}
              disabled={isUploading}
              className="bg-canvas border border-hairline text-ink font-medium px-6 py-3 rounded-lg hover:bg-canvas-soft transition-colors active:scale-95 shadow-sm disabled:opacity-50"
            >
              Browse Files
            </button>
          </div>
        )}

        {files.length > 0 && (
          <div className="w-full flex flex-col gap-4">
            <h3 className="text-title-lg font-bold text-ink border-b border-hairline pb-2">
              Selected Files ({files.length}/3)
            </h3>
            
            {files.map((fileObj) => (
              <div key={fileObj.id} className="w-full flex flex-col bg-canvas-soft border border-hairline rounded-lg p-4">
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center min-w-0 mr-4 flex-1">
                    <div className="w-10 h-10 rounded bg-canvas border border-hairline flex items-center justify-center mr-3 shrink-0">
                      <FileVideo size={20} className="text-primary" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-body-lg text-ink font-medium truncate">{fileObj.file.name}</span>
                      <span className="text-mono text-[12px] text-mute">
                        {(fileObj.file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                  {fileObj.status === 'idle' && (
                    <button onClick={() => removeFile(fileObj.id)} className="p-2 text-mute hover:text-error transition-colors rounded-full hover:bg-canvas shrink-0">
                      <X size={20} />
                    </button>
                  )}
                  {fileObj.status === 'success' && (
                    <CheckCircle2 size={24} className="text-green-400 shrink-0" />
                  )}
                  {fileObj.status === 'error' && (
                    <AlertCircle size={24} className="text-error shrink-0" />
                  )}
                </div>

                {fileObj.error && (
                  <div className="text-error text-[12px] mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {fileObj.error}
                  </div>
                )}

                {fileObj.status === 'uploading' && (
                  <div className="w-full mt-2">
                    <div className="flex justify-between text-mono text-[12px] mb-1 text-mute">
                      <span>Processing...</span>
                      <span>{fileObj.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300 ease-out shadow-[0_0_8px_rgba(34,211,238,0.5)]" 
                        style={{ width: `${fileObj.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {hasIdle && (
              <button 
                onClick={handleUploadAll}
                disabled={isUploading}
                className="mt-4 w-full bg-primary text-on-primary font-bold text-[16px] rounded py-3 flex items-center justify-center gap-2 hover:bg-primary-soft transition-colors active:scale-95 shadow-[0_0_15px_rgba(34,211,238,0.2)] disabled:opacity-50 disabled:active:scale-100"
              >
                <UploadIcon size={18} /> Start Processing {files.filter(f => f.status === 'idle').length > 1 ? 'All' : ''}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

