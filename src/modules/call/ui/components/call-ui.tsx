import { StreamTheme, useCall } from "@stream-io/video-react-sdk";
import { useState } from "react";
import { CallLobby } from "./call-lobby";
import { CallActive } from "./call-active";
import { CallEnded } from "./call-ended";

interface IProps {
  meetingName: string;
}

export const CallUI = ({ meetingName }: IProps) => {
  const call = useCall();
  const [show, setShow] = useState<"lobby" | "call" | "ended">("lobby");
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!call || isJoining) return;

    try {
      setIsJoining(true);
      await call.join();
      setShow("call");
    } catch (error) {
      console.error("Failed to join call:", error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!call) return;
    await call.endCall();
    setShow("ended");
  };

  return (
    <StreamTheme className="h-full">
      {show === "lobby" && <CallLobby onJoin={handleJoin} />}
      {show === "call" && (
        <CallActive onLeave={handleLeave} meetingName={meetingName} />
      )}
      {show === "ended" && <CallEnded />}
    </StreamTheme>
  );
};
