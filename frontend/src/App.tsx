import { Route, Routes } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { NewSessionPage } from "@/pages/NewSessionPage";
import { AssessmentHubPage } from "@/pages/AssessmentHubPage";
import { VisualSearchTaskPage } from "@/pages/VisualSearchTaskPage";
import { MemoryRecognitionTaskPage } from "@/pages/MemoryRecognitionTaskPage";
import { ReadingComprehensionTaskPage } from "@/pages/ReadingComprehensionTaskPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { OverallPatientReportPage } from "@/pages/OverallPatientReportPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { WebcamGazeTestPage } from "@/pages/WebcamGazeTestPage";
import { CalibrationPage } from "@/pages/CalibrationPage";
import { GazeValidationPage } from "@/pages/GazeValidationPage";
import { BaselineVisualAssessmentPage } from "@/pages/BaselineVisualAssessmentPage";
import { ResearchDashboardPage } from "@/pages/ResearchDashboardPage";
import { ResearchReportPage } from "@/pages/ResearchReportPage";
import { PilotStudyPage } from "@/pages/PilotStudyPage";
import { PilotReportPage } from "@/pages/PilotReportPage";

export default function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/new-session" element={<NewSessionPage />} />
        <Route path="/baseline-assessment" element={<BaselineVisualAssessmentPage />} />
        <Route path="/pilot-study" element={<PilotStudyPage />} />
        <Route path="/pilot-report" element={<PilotReportPage />} />
        <Route path="/assessment" element={<AssessmentHubPage />} />
        <Route path="/calibration" element={<CalibrationPage />} />
        <Route path="/gaze-validation" element={<GazeValidationPage />} />
        <Route path="/webcam-test" element={<WebcamGazeTestPage />} />
        <Route path="/tasks/visual-search" element={<VisualSearchTaskPage />} />
        <Route path="/tasks/memory-recognition" element={<MemoryRecognitionTaskPage />} />
        <Route path="/tasks/memory" element={<MemoryRecognitionTaskPage />} />
        <Route path="/tasks/reading-comprehension" element={<ReadingComprehensionTaskPage />} />
        <Route path="/tasks/reading" element={<ReadingComprehensionTaskPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/assessment/:assessmentId" element={<OverallPatientReportPage />} />
        <Route path="/reports/:assessmentId" element={<OverallPatientReportPage />} />
        <Route path="/research-dashboard" element={<ResearchDashboardPage />} />
        <Route path="/research-report" element={<ResearchReportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
