import { useTRPC } from "@/trpc/client";
import {
  Call,
  CallingState,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
} from "@stream-io/video-react-sdk";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import { useMutation } from "@tanstack/react-query";
import { LoaderIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CallUI } from "./call-ui";

interface IProps {
  meetingId: string;
  meetingName: string;
  userId: string;
  userName: string;
  userImage: string;
}

export const CallConnect = ({
  meetingId,
  meetingName,
  userId,
  userImage,
  userName,
}: IProps) => {
  const trpc = useTRPC();
  const { mutateAsync: generateToken } = useMutation(
    trpc.meetings.generateToken.mutationOptions()
  );

  const tokenProvider = useCallback(async () => {
    return generateToken();
  }, [generateToken]);

  const [client, setClient] = useState<StreamVideoClient>();
  const [call, setCall] = useState<Call>();

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY;
    if (!apiKey) return;

    const _client = new StreamVideoClient({
      apiKey,
      user: {
        id: userId,
        name: userName,
        image: userImage,
      },
      tokenProvider,
    });

    setClient(_client);

    return () => {
      _client.disconnectUser();
      setClient(undefined);
    };
  }, [tokenProvider, userId, userImage, userName]);

  useEffect(() => {
    if (!client) return;

    const _call = client.call("default", meetingId);
    _call.camera.disable();
    _call.microphone.disable();
    setCall(_call);

    return () => {
      if (_call.state.callingState !== CallingState.LEFT) {
        _call.leave();
      }
      setCall(undefined);
    };
  }, [client, meetingId]);

  if (!call || !client) {
    return (
      <div className="flex h-screen items-center justify-center bg-radial from-sidebar-accent to-sidebar">
        <LoaderIcon className="size-6 animate-spin text-white" />
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <CallUI meetingName={meetingName} />
      </StreamCall>
    </StreamVideo>
  );
};
