
/**
 * Transforms backend task object to frontend format
 * Backend fields: task_id, task_description, priority, status, assigned_to, 
 *                 created_by, due_date, notes, created_at, etc.
 */
export const transformTask = (backendTask) => {
  if (!backendTask) return null;
  
  // mapping status backend format -> display format
  const statusMap = {
    'pending': 'Pending',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
  };
  
  // mapping priority backend format -> display format
  const priorityMap = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'critical': 'Critical',
  };
  
  return {
    // backend IDs
    id: backendTask.task_id,
    task_id: backendTask.task_id,
    event_id: backendTask.event_id,
    
    // task content
    task_description: backendTask.task_description,
    title: backendTask.title || backendTask.task_description,
    description: backendTask.task_description,
    
    // assignment
    assigned_to: backendTask.assigned_to,
    assigned_to_name: backendTask.assigned_to_name,
    assigned_to_email: backendTask.assigned_to_email,
    assigned_to_phone: backendTask.assigned_to_phone,
    assignTo: backendTask.assigned_to_name || backendTask.assigned_to,
    
    // creator
    created_by: backendTask.created_by,
    created_by_name: backendTask.created_by_name,
    created_by_email: backendTask.created_by_email,
    
    // status & priority
    status: backendTask.status, 
    statusDisplay: statusMap[backendTask.status] || backendTask.status, 
    priority: backendTask.priority,
    priorityDisplay: priorityMap[backendTask.priority] || backendTask.priority, 
    
    // dates
    due_date: backendTask.due_date,
    created_at: backendTask.created_at,
    updated_at: backendTask.updated_at,
    completed_at: backendTask.completed_at,
    date: backendTask.created_at ? new Date(backendTask.created_at).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : null, 
    
    // notes
    notes: backendTask.notes || '',
    relatedCasualty: backendTask.notes || null, 
    
    // event info
    event_name: backendTask.event_name,
    event_status: backendTask.event_status,
    
    // metadata
    updated_by: backendTask.updated_by,
    
    // keep original for reference
    original: backendTask,
  };
};

/**
 * transforms multiple tasks
 */
export const transformTasks = (backendTasks) => {
  if (!Array.isArray(backendTasks)) return [];
  return backendTasks.map(transformTask).filter(Boolean);
};

/**
 * converts frontend task format -> backend format for API calls
 */
export const taskToBackendFormat = (frontendTask) => {
  // mspping display status back to backend format
  const statusReverseMap = {
    'Pending': 'pending',
    'In Progress': 'in_progress',
    'Completed': 'completed',
    'Cancelled': 'cancelled',
  };
  
  // mapping display priority back to backend format
  const priorityReverseMap = {
    'Low': 'low',
    'Medium': 'medium',
    'High': 'high',
    'Critical': 'critical',
  };
  
  return {
    title: frontendTask.title || null,
    task_description: frontendTask.task_description || frontendTask.description,
    assigned_to: frontendTask.assigned_to,
    event_id: frontendTask.event_id,
    priority: priorityReverseMap[frontendTask.priority] || frontendTask.priority?.toLowerCase() || 'medium',
    status: statusReverseMap[frontendTask.status] || frontendTask.status?.toLowerCase() || 'pending',
    due_date: frontendTask.due_date,
    notes: frontendTask.notes || frontendTask.relatedCasualty || null,
  };
};

