import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { HeaderBar } from "./HeaderBar";
import { SessionGuardModal } from "./SessionGuardModal";
import { WebcamCalibrationModal } from "@/components/webcam/WebcamCalibrationModal";
import { GazeDebugDot } from "@/components/webcam/GazeDebugDot";
import { GazeDebugOverlay } from "@/components/webcam/GazeDebugOverlay";

export function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <HeaderBar />
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
      <SessionGuardModal />
      <WebcamCalibrationModal />
      <GazeDebugDot />
      <GazeDebugOverlay />
    </div>
  );
}


