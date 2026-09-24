const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const sampleUsers = [
  {
    name: 'Alice Johnson',
    email: 'alice@example.com',
    password: 'password123',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop',
    about: 'Available for chats and coffee ☕',
  },
  {
    name: 'Bob Smith',
    email: 'bob@example.com',
    password: 'password123',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop',
    about: 'Working remotely 🚀',
  },
  {
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    password: 'password123',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop',
    about: 'Design & Code Enthusiast ✨',
  },
  {
    name: 'Diana Prince',
    email: 'diana@example.com',
    password: 'password123',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop',
    about: 'Living life one day at a time 🌟',
  },
];

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for seeding');

    for (const u of sampleUsers) {
      const exists = await User.findOne({ email: u.email });
      if (!exists) {
        await User.create(u);
        console.log(`Created test user: ${u.name} (${u.email})`);
      } else {
        console.log(`User already exists: ${u.email}`);
      }
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedUsers();
