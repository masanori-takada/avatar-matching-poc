import { Icon } from "./IconSprite";
import { STEPS } from "@/lib/constants";

export interface StepsProps {
  currentIndex: number;
}

/** poc/style.css の .steps を移植した5段階ステップインジケーター */
export function Steps({ currentIndex }: StepsProps) {
  return (
    <ol className="steps">
      {STEPS.map((step, index) => {
        const status = index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
        const iconName = index < currentIndex ? "i-check" : step.icon;
        return (
          <li className={`step step--${status}`} key={step.label}>
            <span className="step__mark">
              <Icon name={iconName} />
            </span>
            <span className="step__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
