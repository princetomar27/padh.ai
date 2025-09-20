// import MeetingIdView, {
//   MeetingIdViewError,
//   MeetingIdViewLoading,
// } from "@/modules/meetings/ui/views/meeting-id-view";
// import { getQueryClient, trpc } from "@/trpc/server";
// import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
// import React, { Suspense } from "react";
// import { ErrorBoundary } from "react-error-boundary";

// interface MeetingIdPageProps {
//   params: Promise<{
//     meetingId: string;
//   }>;
// }

// const MeetingsIdPage = async ({ params }: MeetingIdPageProps) => {
//   const { meetingId } = await params;

//   // prefetch the meeting with id
//   const queryClient = getQueryClient();
//   void queryClient.prefetchQuery(
//     trpc.meetings.getOne.queryOptions({
//       id: meetingId,
//     })
//   );

//   return (
//     <HydrationBoundary state={dehydrate(queryClient)}>
//       <Suspense fallback={<MeetingIdViewLoading />}>
//         <ErrorBoundary fallback={<MeetingIdViewError />}>
//           <MeetingIdView meetingId={meetingId} />
//         </ErrorBoundary>
//       </Suspense>
//     </HydrationBoundary>
//   );
// };

// export default MeetingsIdPage;
