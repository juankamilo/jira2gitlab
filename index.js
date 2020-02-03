const axios = require('axios');

// the base url to your JIRA
const JIRA_URL = '';
const JIRA_PROJECT_KEY = '';

const ACCOUNT = {
    jira_username : '',
    jira_password: '', //account token
    gitlab_username: '',
    gitlab_password: ''
};

// the base url to your GitLab
const GITLAB_URL = '';

// the project in gitlab that you are importing issues to
const GITLAB_PROJECT_ID = '';

// GitLab group id to get members
const GITLAB_GROUP_ID = '';

/**
 * GITLAB_TOKEN is visible in your account
 */
const GITLAB_TOKEN = '';


const getJiraSearch = async (JIRA_PROJECT, offset, limit, gitlab_users) => {
    try {
        const response = await axios.request({
            method: 'get',
            headers: {
                'Content-Type': 'application/json'
            },
            url: `${JIRA_URL}/rest/api/3/search?jql=project=${JIRA_PROJECT} order by id asc&startAt=${offset}&maxResults=${limit}&fields=key,summary,description,comment,reporter,assignee,status,attachment,created,updated`,
            // url: `${JIRA_URL}/rest/api/3/search?jql=project=${JIRA_PROJECT} AND status in (Backlog, "Code Review", "In Progress", "QA Review", "QA Review", "Selected for Development", "To Do") order by id asc&startAt=${offset}&maxResults=${limit}&fields=key,summary,description,comment,reporter,assignee,status,attachment,created,updated,customfield_10006`,
            auth: {
                username: ACCOUNT.jira_username,
                password: ACCOUNT.jira_password
            }
        });

        let assignee;
        let full_comments = '';
        let attachments = '';
        let description = '';
        return response.data.issues.map(function (jira_issue) {
            assignee = '';
            full_comments = '';
            attachments = '';
            description = '';
            console.log(jira_issue.key);
            if (jira_issue.fields.assignee !== null) {
                assignee = jira_issue.fields.assignee.email;
            } else {
                assignee = '';
            }
            if(jira_issue.fields.description !== null) {
                jira_issue.fields.description.content.map(function (content) {
                    content.content.map(function (cont) {
                        if (typeof cont.text !== "undefined") {
                            description = description + '' + cont.text + ' ';
                        }
                    });
                });
            }
            if(jira_issue.fields.comment  !== null) {
                jira_issue.fields.comment.comments.map(function (comments) {
                    comments.body.content.map(function (cont) {
                        cont.content.map(function (cont) {
                            if (typeof cont.text !== "undefined") {
                                full_comments = full_comments + '' + cont.text + ' ';
                            }

                        });

                    });
                });
            }
            if(jira_issue.fields.attachment  !== null) {
                jira_issue.fields.attachment.map(function (attach) {
                    if (typeof attach.content !== "undefined") {
                        attachments = attachments + '' + attach.content + ' <br>';
                    }
                });
            }

            return {
                id: jira_issue.id,
                title: jira_issue.fields.summary,
                description: jira_issue.key+'<br> '+description+' <br><br>comments: '+full_comments+' <br><br>attachments:<br>'+attachments,
                labels: jira_issue.fields.status.name+',Project',
                assignee_ids: jiraToGitlabUser(assignee, gitlab_users),
                reporter: jiraToGitlabUser(jira_issue.fields.reporter.email, gitlab_users),
                created_at: jira_issue.fields.created,
                updated_at: jira_issue.fields.updated,
                key: jira_issue.key,
                milestone_id: jira_issue.fields.customfield_10006 !== null ? 1141860 : '',
                // status: jira_issue.fields.status.name,

            };
        });
    } catch (error) {
        throw new Error(`Unable to get issues ${offset} and  ${error}`);
    }
};


const getGitlabUsers = async () =>{
    try {
        const users =  await axios.request({
            method: 'get',
            // 10000 users, should be enough to get them all
            url: `${GITLAB_URL}/api/v4/groups/${GITLAB_GROUP_ID}/members`,
            headers: {
                'PRIVATE-TOKEN': GITLAB_TOKEN
            }
        });

        return users.data;
    } catch (error) {
        throw new Error(`Unable to get gitlab users ${error}`);
    }

};

function jiraToGitlabUser(jira_user, gitlab_users) {

    let id = '';
    gitlab_users.forEach(function (user) {
        id = '';
        if(typeof user.email !==  "undefined" && user.email === jira_user){
            id = user.id
        }
    });
    return id;
}

const pushGitlabIssues = async(gitlab_issue) => {
    try {

        const response = await axios.request({
            method: 'post',
            url: `${GITLAB_URL}/api/v4/projects/${GITLAB_PROJECT_ID}/issues`,
            // the GitLab issue that we have just created
            data: gitlab_issue,
            headers: {
                'PRIVATE-TOKEN': GITLAB_TOKEN
            }
        });
        return response;

    } catch (error) {
        throw new Error(`Unable to push issues ${error}`);
    }
};

const convertJiraToGitlab = async (jira_project, offset, limit) => {
    const gitlab_users = await getGitlabUsers();
    const issues = await getJiraSearch(jira_project, offset, limit, gitlab_users);

    const push = issues.forEach(function (issue) {
        console.log('-pushing issue:'+issue.key);
        return pushGitlabIssues(issue);
    });

    return issues;
};

convertJiraToGitlab(JIRA_PROJECT_KEY, 6, 60).then(r => {
    console.log(r);
}).catch((error) => {
    console.log(error.message);
});
