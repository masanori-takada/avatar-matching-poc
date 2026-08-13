import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "@/components/feature/InviteForm";
import { Icon } from "@/components/ui/IconSprite";
import { COPY } from "@/lib/constants";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

/**
 * 招待コード入力画面(docs/06-implementation-plan.md フェーズ3)。
 * 登録済みの参加者はホームへリダイレクトする(FR-1.6)。
 */
export default async function InvitePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    redirect("/home");
  }

  return (
    <section className="app-viewport screen--invite">
      <div className="invite__brand">
        <span className="icon-circle icon-circle--lg">
          <Icon name="i-logo" />
        </span>
        <h1 className="invite__service" tabIndex={-1}>
          {COPY.invite.heading}
        </h1>
        <p className="invite__catch">{COPY.catchphrase}</p>
      </div>

      <InviteForm />

      <p className="text-note">
        ※実名や所属は、相手とお互いが「会う」を選ぶまで誰にも表示されません。
      </p>
    </section>
  );
}
