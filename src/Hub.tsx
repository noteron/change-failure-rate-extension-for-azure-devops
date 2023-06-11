import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as SDK from "azure-devops-extension-sdk";
import {
  CommonServiceIds,
  getClient,
  IHostPageLayoutService,
} from "azure-devops-extension-api";
import {
  EnvironmentInstance,
  TaskAgentRestClient,
} from "azure-devops-extension-api/TaskAgent";
import { Build, BuildRestClient } from "azure-devops-extension-api/Build";
import {
  TeamSettingsIteration,
  TimeFrame,
  WorkRestClient,
} from "azure-devops-extension-api/Work";

import { Header, TitleSize } from "azure-devops-ui/Header";
import { IHeaderCommandBarItem } from "azure-devops-ui/HeaderCommandBar";
import { Page } from "azure-devops-ui/Page";
import { Card } from "azure-devops-ui/Card";
import { Pill, PillSize } from "azure-devops-ui/Pill";
import { Icon, IconSize } from "azure-devops-ui/Icon";

import { showRootComponent } from "./Common";

const PROJECT_NAME = "IT";
const ENVIRONMENT_ID = 11;
const TEAM_NAME = "Web";

const NUMBER_OF_ITERATIONS = 5;

enum ReleaseTags {
  Release = "release",
  Hotfix = "hotfix",
  Rollback = "rollback",
}

enum ReleaseType {
  Release = "Release",
  Hotfix = "Hotfix",
}

const HubContent = (): JSX.Element => {
  const [fullScreenMode, setFullScreen] = useState<boolean>(false);
  const [environment, setEnvironment] = useState<EnvironmentInstance>();
  const [iterations, setIterations] = useState<TeamSettingsIteration[]>([]);
  const [buildsByReleaseType, setBuildsByReleaseType] =
    useState<Record<ReleaseType, Build[]>>();
  const [changeFailureRate, setChangeFailureRate] = useState<number>();
  const [totalNormalReleases, setTotalNormalReleases] = useState<number>();
  const [totalHotfixes, setTotalHotfixes] = useState<number>();

  const fetchIterationsForTeam = async () => {
    const iterations = await getClient(WorkRestClient).getTeamIterations({
      project: PROJECT_NAME,
      team: TEAM_NAME,
      projectId: "",
      teamId: "",
    });
    const pastAndPresentIterations = iterations
      .filter(
        (iteration) => iteration.attributes.timeFrame !== TimeFrame.Future
      )
      .slice(-NUMBER_OF_ITERATIONS);
    setIterations(pastAndPresentIterations);
  };

  const fetchReleasesForEnvironment = async () => {
    const environment = await getClient(TaskAgentRestClient).getEnvironmentById(
      PROJECT_NAME,
      ENVIRONMENT_ID
    );
    if (!environment) throw new Error("no environment found");
    setEnvironment(environment);

    const runs = await getClient(
      TaskAgentRestClient
    ).getEnvironmentDeploymentExecutionRecords(PROJECT_NAME, ENVIRONMENT_ID);
    if (!runs) throw new Error("no build runs found");

    const buildIds = runs.map((r) => r.owner.id);
    const builds = await getClient(BuildRestClient).getBuilds(
      PROJECT_NAME,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      buildIds
    );

    const buildsByReleaseType: Record<ReleaseType, Build[]> = builds.reduce<
      Record<ReleaseType, Build[]>
    >(
      (dictionary, currentBuild) => {
        if (currentBuild.tags.length) {
          currentBuild.tags.map((t) => {
            const lowerCaseTag = t.toLowerCase();
            const isNormalRelease = lowerCaseTag === ReleaseTags.Release;
            const isHotfix =
              lowerCaseTag === ReleaseTags.Hotfix ||
              lowerCaseTag.includes(ReleaseTags.Rollback);
            if (!isNormalRelease && !isHotfix) return;

            const releaseType: ReleaseType = isNormalRelease
              ? ReleaseType.Release
              : ReleaseType.Hotfix;

            dictionary[releaseType] = [
              currentBuild,
              ...dictionary[releaseType],
            ];
          });
        }
        return dictionary;
      },
      {
        [ReleaseType.Release]: [],
        [ReleaseType.Hotfix]: [],
      }
    );
    setBuildsByReleaseType(buildsByReleaseType);

    const numberOfReleasesPerType: Record<ReleaseType, number> = {
      [ReleaseType.Release]: buildsByReleaseType[ReleaseType.Release].length,
      [ReleaseType.Hotfix]: buildsByReleaseType[ReleaseType.Hotfix].length,
    };
    const changeFailureRate =
      (numberOfReleasesPerType[ReleaseType.Hotfix] /
        numberOfReleasesPerType[ReleaseType.Release]) *
      100;
    setTotalNormalReleases(numberOfReleasesPerType[ReleaseType.Release]);
    setTotalHotfixes(numberOfReleasesPerType[ReleaseType.Hotfix]);
    setChangeFailureRate(isNaN(changeFailureRate) ? 0 : changeFailureRate);
  };

  useEffect(() => {
    SDK.init();
    initializeFullScreenState();
    fetchIterationsForTeam();
    fetchReleasesForEnvironment();
  }, []);

  const commandBarItems = useMemo((): IHeaderCommandBarItem[] => {
    return [
      {
        id: "fullScreen",
        ariaLabel: fullScreenMode
          ? "Exit full screen mode"
          : "Enter full screen mode",
        iconProps: {
          iconName: fullScreenMode ? "BackToWindow" : "FullScreen",
        },
        onActivate: () => {
          onToggleFullScreenMode();
        },
      },
    ];
  }, []);

  const initializeFullScreenState = async () => {
    const layoutService = await SDK.getService<IHostPageLayoutService>(
      CommonServiceIds.HostPageLayoutService
    );
    const fullScreenMode = await layoutService.getFullScreenMode();
    if (fullScreenMode !== fullScreenMode) {
      setFullScreen((prev) => fullScreenMode);
    }
  };

  const onToggleFullScreenMode = useCallback(async (): Promise<void> => {
    setFullScreen((prev) => !prev);
  }, []);

  useEffect(() => {
    const setFullScreenModeAsync = async () => {
      const layoutService = await SDK.getService<IHostPageLayoutService>(
        CommonServiceIds.HostPageLayoutService
      );
      layoutService.setFullScreenMode(fullScreenMode);
    };
    setFullScreenModeAsync();
  }, [fullScreenMode]);

  return (
    <Page className="sample-hub flex-grow">
      <Header
        title={environment?.name ?? ""}
        commandBarItems={commandBarItems}
        titleSize={TitleSize.Large}
        buttonCount={3}
      />
      <div className="page-content">
        <Card
          titleProps={{ text: "Change failure rate", ariaLevel: 3 }}
          className="margin-bottom-16 margin-top-16 bolt-card-white"
        >
          <div className="flex-grow">
            <div className="flex-row">
              <div className="flex-grow">
                <div className="secondary-title">Ratio</div>
                <div>{changeFailureRate}%</div>
              </div>
              <div className="flex-grow">
                <div className="secondary-title">Normal releases</div>
                <div>{totalNormalReleases}</div>
              </div>
              <div className="flex-grow">
                <div className="secondary-title">Hotfixes</div>
                <div>{totalHotfixes}</div>
              </div>
            </div>

            <div className="margin-top-16 body-s flex-row">
              <Icon
                iconName="Info"
                className="margin-right-4 blue-icon"
                size={IconSize.medium}
              />
              The ratio of changes that fail in production to the total number
              of deployments
            </div>
          </div>
        </Card>

        <Card
          titleProps={{ text: "Last 5 iterations" }}
          className="bolt-card-white"
        >
          {iterations.map((iteration) => {
            if (!buildsByReleaseType) return undefined;

            const releases: Record<ReleaseType, number> = {
              [ReleaseType.Release]: buildsByReleaseType[
                ReleaseType.Release
              ].filter(
                (build) =>
                  build.startTime > iteration.attributes.startDate &&
                  build.startTime < iteration.attributes.finishDate
              ).length,
              [ReleaseType.Hotfix]: buildsByReleaseType[
                ReleaseType.Hotfix
              ].filter(
                (build) =>
                  build.startTime > iteration.attributes.startDate &&
                  build.startTime < iteration.attributes.finishDate
              ).length,
            };
            const noHotfixes = releases.Hotfix === 0;
            const noNormalReleases = releases.Release === 0;
            const ratio = noHotfixes
              ? noNormalReleases
                ? 0
                : 0
              : (releases.Hotfix / releases.Release) * 100;
            return (
              <div key={iteration.id} className="flex-grow">
                <div className="flex-row">
                  <div className="body-l">{iteration.name}</div>
                  {iteration.attributes.timeFrame === TimeFrame.Current && (
                    <Pill size={PillSize.compact} className="margin-left-8">
                      Current
                    </Pill>
                  )}
                </div>
                <div className="flex-row flex-wrap">
                  <div className="body-s">
                    {iteration.attributes.startDate.toLocaleDateString(
                      "en-US",
                      {
                        dateStyle: "medium",
                      }
                    )}
                    &nbsp;-&nbsp;
                  </div>
                  <div className="body-s">
                    {iteration.attributes.finishDate.toLocaleDateString(
                      "en-US",
                      {
                        dateStyle: "medium",
                      }
                    )}
                  </div>
                </div>
                <div className="flex-grow margin-top-8">
                  <div>Normal releases: {releases.Release}</div>
                  <div>Hotfix releases: {releases.Hotfix}</div>
                  <div>Ratio: {ratio}%</div>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </Page>
  );
};

showRootComponent(<HubContent />);
