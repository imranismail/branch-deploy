import * as core from '@actions/core'

// Helper function to check if the current deployment's ref is identical to the merge commit
// :param octokit: the authenticated octokit instance
// :param context: the context object
// :param environment: the environment to check
// :return: true if the current deployment's ref is identical to the merge commit, false otherwise
export async function identicalCommitCheck(octokit, context, environment) {
  // get the owner and the repo from the context
  const {owner, repo} = context.repo

  // find the default branch
  const {data: repoData} = await octokit.rest.repos.get({
    owner,
    repo
  })
  const defaultBranchName = repoData.default_branch
  core.debug(`default branch name: ${defaultBranchName}`)

  // get the latest commit on the default branch of the repo
  const {data: defaultBranchData} = await octokit.rest.repos.getBranch({
    owner,
    repo,
    branch: defaultBranchName
  })
  const defaultBranchTreeSha = defaultBranchData.commit.tree.sha
  core.debug(`default branch three sha: ${defaultBranchTreeSha}`)

  // find the latest deployment with the payload type of branch-deploy
  const {data: deploymentsData} = await octokit.rest.repos.listDeployments({
    owner,
    repo,
    environment,
    sort: 'created_at',
    direction: 'desc',
    per_page: 100
  })
  // loop through all deployments and look for the latest deployment with the payload type of branch-deploy
  var latestDeploymentTreeSha
  var createdAt
  var deploymentId
  for (const deployment of deploymentsData) {
    if (deployment.payload.type === 'branch-deploy') {
      latestDeploymentTreeSha = deployment.sha
      createdAt = deployment.created_at
      deploymentId = deployment.id

      // get the tree sha of the latest deployment
      const commitData = await octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: latestDeploymentTreeSha
      })
      latestDeploymentTreeSha = commitData.data.tree.sha
      break
    }
  }

  core.info(`latest deployment sha: ${latestDeploymentTreeSha}`)
  core.debug('latest deployment with payload type of "branch-deploy"')
  core.debug(`latest deployment sha: ${latestDeploymentTreeSha}`)
  core.debug(`latest deployment created at: ${createdAt}`)
  core.debug(`latest deployment id: ${deploymentId}`)

  // if the latest deployment sha is identical to the latest commit on the default branch then return true
  const result = latestDeploymentTreeSha === defaultBranchTreeSha

  if (result) {
    core.info('latest deployment sha is identical to the latest commit sha')
    core.info(
      'identical commits will not be deployed again based on your configuration'
    )
    core.setOutput('continue', 'false')
    core.setOutput('environment', environment)
  } else {
    core.info(
      'latest deployment is not identical to the latest commit on the default branch'
    )
    core.info('a new deployment will be created based on your configuration')
    core.setOutput('continue', 'true')
    core.setOutput('environment', environment)
  }

  return result
}
