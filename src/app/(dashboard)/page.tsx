import { redirect } from "next/navigation";

/** Authenticated root; middleware normally sends users to role home before this runs. */
const Page = () => {
  redirect("/dashboard");
};

export default Page;
