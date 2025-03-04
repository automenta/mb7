core/ontology.js
const isValidDate = (dateString) => {
    try {
        return !isNaN(new Date(dateString).getTime());
    } catch (error) {
        return false;
    }
}

const Ontology = {
    "Person": {
        "tags": {
            "name": {
                "type": "text",
                "description": "Full name of the person."
            },
            "birthday": {
                "type": "date",
                "description": "Date of birth.",
                "validation": isValidDate
            },
            "email": {
                "type": "email",
                "description": "Email address."
            },
            "phone": {
                "type": "tel",
                "description": "Phone number."
            },
            "address": {
                "type": "text",
                "description": "Physical address."
            }
        }
    },
    "Task": {
        "tags": {
            "title": {
                "type": "text",
                "description": "Title of the task."
            },
            "description": {
                "type": "textarea",
                "description": "Detailed description of the task."
            },
            "dueDate": {
                "type": "date",
                "description": "Date when the task is due.",
                "validation": isValidDate
            },
            "priority": {
                "type": "select",
                "options": ["High", "Medium", "Low"],
                "description": "Priority level."
            },
            "status": {
                "type": "select",
                "options": ["Open", "InProgress", "Completed", "Cancelled"],
                "description": "Current status of the task."
            },
            "assignedTo": {
                "type": "object",
                "objectType": "Person",
                "description": "Person assigned to the task."
            }
        }
    },
    "Project": {
        "tags": {
            "projectName": {
                "type": "text",
                "description": "Name of the project."
            },
            "projectDescription": {
                "type": "textarea",
                "description": "Description of the project."
            },
            "startDate": {
                "type": "date",
                "description": "Project start date.",
                "validation": isValidDate
            },
            "endDate": {
                "type": "date",
                "description": "Project end date.",
                "validation": isValidDate
            },
            "projectStatus": {
                "type": "select",
                "options": ["Planning", "InProgress", "Completed", "OnHold", "Cancelled"],
                "description": "Current project status."
            },
            "teamMembers": {
                "type": "array",
                "items": {
                    "type": "object",
                    "objectType": "Person"
                },
                "description": "Team members involved in the project."
            }
        }
    },
    "Event": {
        "tags": {
            "eventName": {
                "type": "text",
                "description": "Name of the event."
            },
            "eventDescription": {
                "type": "textarea",
                "description": "Description of the event."
            },
            "eventDate": {
                "type": "date",
                "description": "Date of the event.",
                "validation": isValidDate
            },
            "eventTime": {
                "type": "time",
                "description": "Time of the event."
            },
            "eventLocation": {
                "type": "text",
                "description": "Location of the event."
            },
            "eventAttendees": {
                "type": "array",
                "items": {
                    "type": "object",
                    "objectType": "Person"
                },
                "description": "People attending the event."
            }
        }
    },
    "Note": {
        "tags": {
            "noteTitle": {
                "type": "text",
                "description": "Title of the note."
            },
            "noteContent": {
                "type": "textarea",
                "description": "Content of the note."
            },
            "createdDate": {
                "type": "date",
                "description": "Date created.",
                "validation": isValidDate
            },
            "lastModifiedDate": {
                "type": "date",
                "description": "Date last modified.",
                "validation": isValidDate
            },
            "category": {
                "type": "select",
                "options": ["Personal", "Work", "Ideas", "Research"],
                "description": "Category of the note."
            },
            "tags": {
                "type": "array",
                "items": {
                    "type": "text"
                },
                "description": "Tags associated with the note."
            }
        }
    },
    "Contact": {
        "tags": {
            "contactName": {
                "type": "text",
                "description": "Name of the contact."
            },
            "contactEmail": {
                "type": "email",
                "description": "Email address of the contact."
            },
            "contactPhone": {
                "type": "tel",
                "description": "Phone number of the contact."
            },
            "relationship": {
                "type": "select",
                "options": ["Friend", "Family", "Colleague", "Client"],
                "description": "Relationship type."
            },
            "notes": {
                "type": "textarea",
                "description": "Notes about the contact."
            }
        }
    },
    "Document": {
        "tags": {
            "documentTitle": {
                "type": "text",
                "description": "Title of the document."
            },
            "author": {
                "type": "text",
                "description": "Author of the document."
            },
            "publicationDate": {
                "type": "date",
                "description": "Date of publication.",
                "validation": isValidDate
            },
            "documentType": {
                "type": "select",
                "options": ["Report", "Article", "Book", "Presentation", "Manual"],
                "description": "Type of document."
            },
            "keywords": {
                "type": "array",
                "items": {
                    "type": "text"
                },
                "description": "Keywords associated with the document."
            }
        }
    },
    "Meeting": {
        "tags": {
            "meetingTitle": {
                "type": "text",
                "description": "Title of the meeting."
            },
            "meetingDescription": {
                "type": "textarea",
                "description": "Description of the meeting."
            },
            "meetingDate": {
                "type": "date",
                "description": "Date of the meeting.",
                "validation": isValidDate
            },
            "meetingTime": {
                "type": "time",
                "description": "Time of the meeting."
            },
            "attendees": {
                "type": "array",
                "items": {
                    "type": "object",
                    "objectType": "Person"
                },
                "description": "People attending the meeting."
            },
            "agenda": {
                "type": "textarea",
                "description": "Meeting agenda."
            },
            "minutes": {
                "type": "textarea",
                "description": "Meeting minutes."
            }
        }
    },
    "Decision": {
        "tags": {
            "decisionTitle": {
                "type": "text",
                "description": "Title of the decision."
            },
            "decisionDescription": {
                "type": "textarea",
                "description": "Description of the decision."
            },
            "decisionDate": {
                "type": "date",
                "description": "Date of the decision.",
                "validation": isValidDate
            },
            "decisionMaker": {
                "type": "object",
                "objectType": "Person",
                "description": "Person who made the decision."
            },
            "rationale": {
                "type": "textarea",
                "description": "Rationale behind the decision."
            },
            "status": {
                "type": "select",
                "options": ["Proposed", "Approved", "Rejected", "Implemented", "Deferred"],
                "description": "Current status of the decision."
            }
        }
    },
    "Goal": {
        "tags": {
            "goalTitle": {
                "type": "text",
                "description": "Title of the goal."
            },
            "goalDescription": {
                "type": "textarea",
                "description": "Description of the goal."
            },
            "startDate": {
                "type": "date",
                "description": "Start date for achieving the goal.",
                "validation": isValidDate
            },
            "targetDate": {
                "type": "date",
                "description": "Target date for achieving the goal.",
                "validation": isValidDate
            },
            "progress": {
                "type": "number",
                "min": 0,
                "max": 100,
                "description": "Progress towards the goal (in percentage)."
            },
            "status": {
                "type": "select",
                "options": ["Planned", "InProgress", "Achieved", "OnHold", "Abandoned"],
                "description": "Current status of the goal."
            }
        }
    }
};


export default Ontology;
