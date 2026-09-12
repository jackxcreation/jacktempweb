const calculateSLA = (priority) => {
  const now = new Date();
  let deadline = new Date(now);

  switch (priority) {
    case 'URGENT':
      deadline.setHours(now.getHours() + 1); // 1 hour SLA
      break;
    case 'HIGH':
      deadline.setHours(now.getHours() + 4); // 4 hours SLA
      break;
    case 'LOW':
      deadline.setHours(now.getHours() + 48); // 48 hours SLA
      break;
    case 'MEDIUM':
    default:
      deadline.setHours(now.getHours() + 24); // 24 hours SLA
      break;
  }

  return { deadline, status: 'NORMAL' };
};

module.exports = { calculateSLA };