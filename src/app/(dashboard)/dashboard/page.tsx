import { getCurrentUser } from "@/lib/current-user";
import { StudentDashboardView } from "@/modules/student-dashboard/ui/student-dashboard-view";
import { redirect } from "next/navigation";

const DashboardPage = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (user.role === "STUDENT") {
    return <StudentDashboardView displayName={user.name} />;
  }

  if (user.role === "ADMIN") {
    redirect("/admin");
  }
  if (user.role === "PARENT") {
    redirect("/parents");
  }

  return <StudentDashboardView displayName={user.name} />;
};

export default DashboardPage;
