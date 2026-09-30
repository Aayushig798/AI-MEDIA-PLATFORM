"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BarChart3, FileText } from "lucide-react";
import { ReportBuilder } from "@/components/ReportBuilder";
import { PageHeader, Loading } from "@/components/ui";

export default function ProjectReportPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [project, setProject] = useState<{ id: string; name: string; location?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/impact-stats`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.facts) {
          setProject({
            id: data.facts.projectId,
            name: data.facts.projectName,
            location: data.facts.projectLocation,
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading && !project) {
    return <Loading label="Loading report" />;
  }

  const projectName = project?.name || "Impact Evidence Project";

  return (
    <div className="space-y-8 print:space-y-0">
      <div className="print:hidden">
        <PageHeader
          back={{ href: `/projects/${projectId}`, label: "Back to project" }}
          eyebrow={projectName}
          icon={FileText}
          title="Report"
          description="Turn the verified evidence for this project into a report you can share with funders and partners."
          actions={
            <Link href={`/projects/${projectId}/dashboard`} className="btn btn-secondary">
              <BarChart3 className="h-4 w-4" />
              View insights
            </Link>
          }
        />
      </div>

      <ReportBuilder projectId={projectId} projectName={projectName} />
    </div>
  );
}
