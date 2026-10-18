import { useWizard } from "@/components/link-in-bio/wizard/WizardProvider";
import { wizardUi } from "@/components/link-in-bio/wizard/wizardTokens";
import { useLanguage } from "@/lib/i18n";

export function ArrangeStep() {
  const { t } = useLanguage();
  const { draft, focusId } = useWizard();
  const selected = draft.links.find((link) => link.id === focusId && link.enabled);

  return (
    <div className="grid gap-3">
      <p className="text-sm leading-relaxed text-white/50">{t("linkInBio.wizard.arrange.instructions")}</p>
      {draft.links.some((link) => link.kind === "link" && link.enabled) ? (
        <p className={wizardUi.hint}>
          {selected
            ? t("linkInBio.wizard.arrange.selected", { title: selected.title || selected.platform })
            : t("linkInBio.wizard.arrange.clickToSelect")}
        </p>
      ) : (
        <p className={wizardUi.hint}>{t("linkInBio.wizard.arrange.noPlatforms")}</p>
      )}
    </div>
  );
}
