/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Command } from "./pages/Command";
import { Visualize } from "./pages/Visualize";
import { Upload } from "./pages/Upload";
import { Pipeline } from "./pages/Pipeline";
import { ProjectProvider } from "./context/ProjectContext";

export default function App() {
  return (
    <ProjectProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Command />} />
            <Route path="upload" element={<Upload />} />
            <Route path="visualize" element={<Visualize />} />
            <Route path="pipeline" element={<Pipeline />} />
            {/* Catch-all to Command for placeholder routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ProjectProvider>
  );
}
