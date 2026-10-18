const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { readFile } = require('node:fs/promises');

// Load env from server directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Ticket = require('../models/Ticket');
const { provisionAccounts, DEFAULT_CREDENTIALS_PATH } = require('../scripts/provision-accounts');

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected for seeding...');

    // Drop existing collections
    await User.deleteMany({});
    console.log('Users collection cleared.');
    await Ticket.deleteMany({});
    console.log('Tickets collection cleared.');

    // ==================== CREATE USERS ====================
    const usersData = [
      {
        firstName: 'Maria',
        lastName: 'Santos',
        email: 'maria.santos@email.com',
        password: 'Password123!',
        role: 'admin',
        phone: '09171234567',
        address: '123 Roxas Boulevard, Barangay Baclaran, Parañaque City',
      },
      {
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        email: 'juan.delacruz@email.com',
        password: 'Password123!',
        role: 'admin',
        phone: '09181234568',
        address: '45 Redemptorist Road, Barangay Baclaran, Parañaque City',
      },
      {
        firstName: 'Ana',
        lastName: 'Reyes',
        email: 'ana.reyes@email.com',
        password: 'Password123!',
        role: 'user',
        phone: '09191234569',
        address: '78 Quirino Avenue, Barangay Baclaran, Parañaque City',
      },
      {
        firstName: 'Pedro',
        lastName: 'Garcia',
        email: 'pedro.garcia@email.com',
        password: 'Password123!',
        role: 'user',
        phone: '09201234570',
        address: '156 Ocean Drive, Barangay Baclaran, Parañaque City',
      },
      {
        firstName: 'Rosa',
        lastName: 'Martinez',
        email: 'rosa.martinez@email.com',
        password: 'Password123!',
        role: 'user',
        phone: '09211234571',
        address: '32 Taft Avenue Extension, Barangay Baclaran, Parañaque City',
      },
      {
        firstName: 'Carlos',
        lastName: 'Bautista',
        email: 'carlos.bautista@email.com',
        password: 'Password123!',
        role: 'user',
        phone: '09221234572',
        address: '89 F.B. Harrison Street, Barangay Baclaran, Parañaque City',
      },
      {
        firstName: 'Elena',
        lastName: 'Villanueva',
        email: 'elena.villanueva@email.com',
        password: 'Password123!',
        role: 'user',
        phone: '09231234573',
        address: '210 Coastal Road, Barangay Baclaran, Parañaque City',
      },
      {
        firstName: 'Roberto',
        lastName: 'Aquino',
        email: 'roberto.aquino@email.com',
        password: 'Password123!',
        role: 'user',
        phone: '09241234574',
        address: '67 Multinational Avenue, Barangay Baclaran, Parañaque City',
      },
      {
        firstName: 'Lorna',
        lastName: 'Fernandez',
        email: 'lorna.fernandez@email.com',
        password: 'Password123!',
        role: 'user',
        phone: '09251234575',
        address: '143 San Antonio Street, Barangay Baclaran, Parañaque City',
      },
      {
        firstName: 'Miguel',
        lastName: 'Torres',
        email: 'miguel.torres@email.com',
        password: 'Password123!',
        role: 'user',
        phone: '09261234576',
        address: '55 Airport Road, Barangay Baclaran, Parañaque City',
      },
    ];

    const users = await User.create(usersData);
    console.log(`${users.length} users created.`);

    // Map users by name for easy reference
    const userMap = {};
    users.forEach((u) => {
      userMap[`${u.firstName} ${u.lastName}`] = u._id;
    });

    // ==================== CREATE TICKETS ====================
    const now = new Date();
    const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const ticketsData = [
      // === RESOLVED TICKETS (13) ===
      {
        title: 'Repaired pedestrian ramp near Baclaran market',
        description: 'The damaged access ramp beside the market entrance was repaired by the barangay maintenance crew. The surface is now level and safe for wheelchair users and residents carrying goods.',
        category: 'Infrastructure',
        status: 'Resolved',
        priority: 'High',
        location: 'Baclaran Public Market entrance, Quirino Avenue',
        submittedBy: userMap['Ana Reyes'],
        resolvedAt: daysAgo(3),
        createdAt: daysAgo(10),
      },
      {
        title: 'Cleared drainage inlet on Ocean Drive',
        description: 'Residents reported leaves and plastic blocking the roadside drainage inlet. The sanitation team removed the debris and confirmed that rainwater now flows freely into the drain.',
        category: 'Sanitation',
        status: 'Resolved',
        priority: 'Medium',
        location: 'Ocean Drive, beside Block 3 community store',
        submittedBy: userMap['Pedro Garcia'],
        resolvedAt: daysAgo(4),
        createdAt: daysAgo(12),
      },
      {
        title: 'Restored streetlight on Taft Avenue Extension',
        description: 'A streetlight beside the tricycle waiting area had been flickering for several days. The maintenance crew replaced the faulty lamp and verified normal operation during the evening inspection.',
        category: 'Utilities',
        status: 'Resolved',
        priority: 'Medium',
        location: 'Taft Avenue Extension, tricycle waiting area',
        submittedBy: userMap['Rosa Martinez'],
        resolvedAt: daysAgo(5),
        createdAt: daysAgo(13),
      },
      {
        title: 'Removed loose branch along Redemptorist Road',
        description: 'A loose tree branch was hanging above the sidewalk after strong winds. The barangay maintenance team trimmed the branch and cleared the pavement before reopening the walkway.',
        category: 'Environmental Hazard',
        status: 'Resolved',
        priority: 'High',
        location: 'Redemptorist Road, beside the community notice board',
        submittedBy: userMap['Elena Villanueva'],
        resolvedAt: daysAgo(6),
        createdAt: daysAgo(14),
      },
      {
        title: 'Removed boxes obstructing Airport Road sidewalk',
        description: 'Delivery boxes had been left across the pedestrian walkway. Barangay staff coordinated with the store owner to remove the boxes and agreed on a designated loading area that keeps the sidewalk clear.',
        category: 'Public Safety',
        status: 'Resolved',
        priority: 'Medium',
        location: 'Airport Road, storefront beside the jeepney terminal',
        submittedBy: userMap['Miguel Torres'],
        resolvedAt: daysAgo(7),
        createdAt: daysAgo(15),
      },
      {
        title: 'Overflowing garbage bins near Baclaran Church',
        description: 'The garbage bins along the sidewalk near Baclaran Church have been overflowing for three days. The smell is unbearable and it attracts stray animals. Immediate collection is needed.',
        category: 'Sanitation',
        status: 'Resolved',
        priority: 'High',
        location: 'Baclaran Church, Roxas Boulevard, Barangay Baclaran',
        submittedBy: userMap['Ana Reyes'],
        resolvedAt: daysAgo(2),
        createdAt: daysAgo(10),
      },
      {
        title: 'Pothole on Quirino Avenue causing accidents',
        description: 'A large pothole has formed on Quirino Avenue near the intersection with Taft Avenue Extension. Several motorcycles have already had accidents. The pothole is approximately 2 feet wide and 6 inches deep.',
        category: 'Infrastructure',
        status: 'Resolved',
        priority: 'Urgent',
        location: 'Quirino Avenue corner Taft Avenue Extension, Barangay Baclaran',
        submittedBy: userMap['Pedro Garcia'],
        resolvedAt: daysAgo(5),
        createdAt: daysAgo(20),
      },
      {
        title: 'Broken streetlight on F.B. Harrison Street',
        description: 'The streetlight in front of the 7-Eleven on F.B. Harrison Street has been broken for a week. The area is very dark at night, making it unsafe for pedestrians, especially women and children.',
        category: 'Utilities',
        status: 'Resolved',
        priority: 'High',
        location: 'F.B. Harrison Street near 7-Eleven, Barangay Baclaran',
        submittedBy: userMap['Carlos Bautista'],
        resolvedAt: daysAgo(3),
        createdAt: daysAgo(14),
      },
      {
        title: 'Illegal dumping site behind Baclaran Market',
        description: 'Residents and vendors have been dumping waste illegally behind Baclaran Market. The pile has grown significantly and is a health hazard. Rats and cockroaches are spreading to nearby homes.',
        category: 'Environmental Hazard',
        status: 'Resolved',
        priority: 'Urgent',
        location: 'Behind Baclaran Market, Redemptorist Road, Barangay Baclaran',
        submittedBy: userMap['Rosa Martinez'],
        resolvedAt: daysAgo(1),
        createdAt: daysAgo(8),
      },
      {
        title: 'Water main leak on Coastal Road',
        description: 'A water main pipe has burst on Coastal Road near the residential area. Water has been flowing continuously for two days, flooding the sidewalk and parts of the road. The water pressure in nearby homes has dropped.',
        category: 'Utilities',
        status: 'Resolved',
        priority: 'Urgent',
        location: 'Coastal Road near Block 5, Barangay Baclaran',
        submittedBy: userMap['Elena Villanueva'],
        resolvedAt: daysAgo(6),
        createdAt: daysAgo(9),
      },
      {
        title: 'Clogged drainage causing street flooding',
        description: 'The drainage system along Multinational Avenue is severely clogged. Even light rain causes the street to flood knee-deep. Several homes have been affected by floodwater entering their ground floors.',
        category: 'Infrastructure',
        status: 'Resolved',
        priority: 'High',
        location: 'Multinational Avenue, Barangay Baclaran',
        submittedBy: userMap['Roberto Aquino'],
        resolvedAt: daysAgo(4),
        createdAt: daysAgo(15),
      },
      {
        title: 'Stray dogs threatening residents near the park',
        description: 'A pack of aggressive stray dogs has been roaming near the barangay park. They have chased children and elderly residents. One resident was bitten last week. Animal control intervention is urgently needed.',
        category: 'Public Safety',
        status: 'Resolved',
        priority: 'Urgent',
        location: 'Barangay Park, San Antonio Street, Barangay Baclaran',
        submittedBy: userMap['Lorna Fernandez'],
        resolvedAt: daysAgo(7),
        createdAt: daysAgo(18),
      },
      {
        title: 'Construction noise violation on weekends',
        description: 'A construction site on Airport Road has been operating heavy machinery on weekends starting as early as 5:00 AM. This violates the barangay noise ordinance. Multiple residents have complained about the disturbance.',
        category: 'Noise Complaint',
        status: 'Resolved',
        priority: 'Medium',
        location: 'Airport Road, near Gate 3, Barangay Baclaran',
        submittedBy: userMap['Miguel Torres'],
        resolvedAt: daysAgo(10),
        createdAt: daysAgo(25),
      },

      // === DISMISSED TICKETS (7) ===
      {
        title: 'Alleged illegal parking on private property',
        description: 'A resident complained about vehicles parking on what they claim is public space. Upon investigation, the area is confirmed to be private property owned by a legitimate business with proper parking permits.',
        category: 'Security',
        status: 'Dismissed',
        priority: 'Low',
        location: 'Roxas Boulevard Service Road, Barangay Baclaran',
        submittedBy: userMap['Ana Reyes'],
        dismissedAt: daysAgo(12),
        createdAt: daysAgo(22),
      },
      {
        title: 'Noise from karaoke bar already within hours',
        description: 'Resident reported excessive noise from a karaoke bar on Taft Avenue Extension. Investigation confirmed the establishment operates within permitted hours (10 AM to 10 PM) and noise levels are within acceptable limits.',
        category: 'Noise Complaint',
        status: 'Dismissed',
        priority: 'Low',
        location: 'Taft Avenue Extension, Barangay Baclaran',
        submittedBy: userMap['Pedro Garcia'],
        dismissedAt: daysAgo(8),
        createdAt: daysAgo(16),
      },
      {
        title: 'Duplicate report: Pothole on Quirino Avenue',
        description: 'This is a duplicate report of the pothole on Quirino Avenue that has already been reported and resolved. The repair work was completed last week.',
        category: 'Infrastructure',
        status: 'Dismissed',
        priority: 'Medium',
        location: 'Quirino Avenue, Barangay Baclaran',
        submittedBy: userMap['Rosa Martinez'],
        dismissedAt: daysAgo(3),
        createdAt: daysAgo(5),
      },
      {
        title: 'Request to trim trees on private lot',
        description: 'Resident requested trimming of trees that are on private property. This falls outside barangay jurisdiction. The property owner has been notified and will handle the trimming.',
        category: 'Environmental Hazard',
        status: 'Dismissed',
        priority: 'Low',
        location: 'Ocean Drive, Barangay Baclaran',
        submittedBy: userMap['Carlos Bautista'],
        dismissedAt: daysAgo(6),
        createdAt: daysAgo(11),
      },
      {
        title: 'Complaint about street vendor already permitted',
        description: 'A complaint was filed about a street vendor blocking the sidewalk on Redemptorist Road. Investigation showed the vendor has a valid barangay permit and is operating within the designated vending area.',
        category: 'Public Safety',
        status: 'Dismissed',
        priority: 'Low',
        location: 'Redemptorist Road, Barangay Baclaran',
        submittedBy: userMap['Elena Villanueva'],
        dismissedAt: daysAgo(9),
        createdAt: daysAgo(17),
      },
      {
        title: 'False alarm: Suspected gas leak',
        description: 'Resident reported a gas-like smell near their home on San Antonio Street. Emergency response team investigated and confirmed the smell was from a nearby restaurant cooking. No gas leak detected.',
        category: 'Public Safety',
        status: 'Dismissed',
        priority: 'High',
        location: 'San Antonio Street, Barangay Baclaran',
        submittedBy: userMap['Roberto Aquino'],
        dismissedAt: daysAgo(2),
        createdAt: daysAgo(3),
      },
      {
        title: 'Duplicate report: Broken streetlight Harrison St',
        description: 'This is a duplicate of the broken streetlight report on F.B. Harrison Street. The original report has already been addressed and the streetlight has been repaired.',
        category: 'Utilities',
        status: 'Dismissed',
        priority: 'Medium',
        location: 'F.B. Harrison Street, Barangay Baclaran',
        submittedBy: userMap['Lorna Fernandez'],
        dismissedAt: daysAgo(4),
        createdAt: daysAgo(13),
      },

      // === IN PROGRESS TICKETS (3) ===
      {
        title: 'Exposed electrical wires on Redemptorist Road',
        description: 'Electrical wires are hanging dangerously low near the pedestrian walkway on Redemptorist Road. Some wires appear to be stripped of insulation. This poses a serious electrocution risk, especially during rainy weather.',
        category: 'Public Safety',
        status: 'In Progress',
        priority: 'Urgent',
        location: 'Redemptorist Road, near Baclaran LRT Station, Barangay Baclaran',
        submittedBy: userMap['Ana Reyes'],
        createdAt: daysAgo(3),
      },
      {
        title: 'Damaged road markings at school zone',
        description: 'The pedestrian crossing and school zone markings on F.B. Harrison Street near Baclaran Elementary School have faded completely. With the school year ongoing, this creates a dangerous situation for students crossing the road.',
        category: 'Infrastructure',
        status: 'In Progress',
        priority: 'High',
        location: 'F.B. Harrison Street, near Baclaran Elementary School, Barangay Baclaran',
        submittedBy: userMap['Miguel Torres'],
        createdAt: daysAgo(6),
      },
      {
        title: 'Overflowing septic tank in residential area',
        description: 'A septic tank in the residential compound on Ocean Drive has been overflowing onto the shared pathway. The sewage has been flowing for two days and the smell is affecting the entire block. A pumping truck has been requested.',
        category: 'Sanitation',
        status: 'In Progress',
        priority: 'High',
        location: 'Ocean Drive, Block 12, Barangay Baclaran',
        submittedBy: userMap['Pedro Garcia'],
        createdAt: daysAgo(2),
      },

      // === PENDING TICKETS (5) ===
      {
        title: 'Suspicious individuals loitering near ATM',
        description: 'For the past week, a group of 3-4 unidentified individuals have been loitering near the BDO ATM on Roxas Boulevard every night from 10 PM to 2 AM. They appear to be watching people who use the ATM. Several residents feel unsafe withdrawing money.',
        category: 'Security',
        status: 'Pending',
        priority: 'High',
        location: 'BDO ATM, Roxas Boulevard, Barangay Baclaran',
        submittedBy: userMap['Lorna Fernandez'],
        createdAt: daysAgo(1),
      },
      {
        title: 'Loud party every night at Coastal Road apartment',
        description: 'An apartment unit on Coastal Road has been hosting loud parties almost every night past midnight. The music is loud enough to be heard several blocks away. Multiple neighbors have been unable to sleep on work nights.',
        category: 'Noise Complaint',
        status: 'Pending',
        priority: 'Medium',
        location: 'Coastal Road, Unit 4B Seaside Apartments, Barangay Baclaran',
        submittedBy: userMap['Elena Villanueva'],
        createdAt: daysAgo(1),
      },
      {
        title: 'Uncollected garbage on San Antonio Street',
        description: 'Garbage has not been collected on San Antonio Street for over a week. The pile-up is creating unsanitary conditions. Flies and mosquitoes are breeding in the accumulated waste. Several residents have reported getting sick.',
        category: 'Sanitation',
        status: 'Pending',
        priority: 'High',
        location: 'San Antonio Street, Block 7-9, Barangay Baclaran',
        submittedBy: userMap['Roberto Aquino'],
        createdAt: daysAgo(0),
      },
      {
        title: 'Cracked sidewalk causing tripping hazard',
        description: 'The sidewalk along Airport Road near the jeepney terminal has large cracks and uneven sections. An elderly resident tripped and fell yesterday. The damaged section is approximately 20 meters long.',
        category: 'Infrastructure',
        status: 'Pending',
        priority: 'Medium',
        location: 'Airport Road, near Jeepney Terminal, Barangay Baclaran',
        submittedBy: userMap['Miguel Torres'],
        createdAt: daysAgo(0),
      },
      {
        title: 'Chemical smell from warehouse on Multinational Ave',
        description: 'A strong chemical smell has been emanating from a warehouse on Multinational Avenue. The smell is especially strong in the morning and evening. Nearby residents are experiencing headaches and nausea. The source needs to be investigated.',
        category: 'Environmental Hazard',
        status: 'Pending',
        priority: 'Urgent',
        location: 'Multinational Avenue, Warehouse District, Barangay Baclaran',
        submittedBy: userMap['Carlos Bautista'],
        createdAt: daysAgo(0),
      },
    ];

    const tickets = await Ticket.insertMany(ticketsData);
    console.log(`${tickets.length} tickets created.`);

    const credentialsPath = process.env.BMIS_DEMO_CREDENTIALS_PATH || DEFAULT_CREDENTIALS_PATH;
    const dispatch = await provisionAccounts({ credentialsPath });
    const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
    const passwords = new Map(credentials.accounts.map(account => [account.email, account.password]));
    const seedAccounts = [...usersData, ...dispatch.accounts.map(account => ({ ...account, password: passwords.get(account.email) }))];

    console.log('\n========================================');
    console.log(`  Database seeded successfully! ${seedAccounts.length} accounts available.`);
    console.log('========================================');
    for (const [role, label] of [['admin', 'Admin'], ['employee', 'Employee'], ['user', 'User']]) {
      console.log(`\n${label} Accounts:`);
      for (const account of seedAccounts.filter(account => account.role === role)) {
        console.log(`  ${account.email} / ${account.password}`);
      }
    }
    console.log(`\nDispatch account passwords saved in: ${credentialsPath}`);
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error.message);
    process.exit(1);
  }
};

seedDB();
