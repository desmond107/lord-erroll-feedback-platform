import { redirect } from "next/navigation";
import { getPending2fa, getUser } from "@/lib/auth";
import { Crest, GoldRule } from "@/components/brand";
import LoginForm from "./LoginForm";

export const metadata = { title: "Owner portal sign-in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getUser()) redirect("/portal");
  const { next = "/portal" } = await searchParams;
  const pending = await getPending2fa();
  return (
    <div className="paper flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Crest size={88} priority />
          <div className="mt-4 font-serif text-3xl font-semibold">The Lord Erroll</div>
          <div className="mt-1 text-[0.65rem] tracking-[0.32em] text-gold-ink uppercase">Owner portal</div>
          <GoldRule className="mt-5 w-40" />
        </div>
        <div className="card p-6">
          <LoginForm next={next} initialStep={pending ? "totp" : "password"} />
        </div>
        <p className="mt-6 text-center text-xs text-muted">Private area for The Lord Erroll management. All access is logged.</p>
      </div>
    </div>
  );
}
