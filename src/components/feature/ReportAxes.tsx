import { Bar } from "@/components/ui/Bar";
import { Card } from "@/components/ui/Card";
import { COPY } from "@/lib/constants";
import type { ReportAxis } from "@/types/domain";

export interface ReportAxesProps {
  axes: ReportAxis[];
}

/**
 * 相性レポートの5軸表示(docs/03-data-model.md §5.2, FR-5.3)。
 * conflict 軸には「低いほど良い」を明示する。
 */
export function ReportAxes({ axes }: ReportAxesProps) {
  return (
    <div>
      <h2 className="section-title">{COPY.report.axesTitle}</h2>
      {axes.map((axis) => (
        <Card className="axis" key={axis.key}>
          <div className="axis__head">
            <span className="axis__label">
              {axis.label}
              {axis.invertedGood ? (
                <span className="axis__hint">{COPY.report.invertedGoodHint}</span>
              ) : null}
            </span>
            <span className="axis__score">{axis.score}</span>
          </div>
          <Bar score={axis.score} label={axis.label} neutral={axis.invertedGood} />
          <p className="text-body axis__comment">{axis.comment}</p>
          <p className="axis__quote">「{axis.quote}」</p>
        </Card>
      ))}
    </div>
  );
}
