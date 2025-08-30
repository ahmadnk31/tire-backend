# Ariana Banden Service Seeding Guide

This guide explains how to seed the database with Ariana Banden Service tire data.

## Overview

The seeding script creates comprehensive tire inventory data based on the Ariana Banden Service catalog, including:

- **200+ tire products** across all sizes (13" to 21")
- **4 categories**: Summer, Winter, All-Season, and Commercial tires
- **5 major brands**: Michelin, Goodyear, Continental, Bridgestone, Pirelli
- **Realistic pricing** based on the provided price list
- **Complete product details** including specifications and features

## Tire Sizes and Pricing

### 13" Tires - €25-30 (with mounting and balancing)
- 165/70R13, 165/65R13, 175/65R13, 145/80R13, 155/80R13
- 145/70R13, 155/70R13, 175/70R13, 185/70R13, 175/80R13

### 14" Tires - €25-30 (with mounting and balancing)
- 155/65R14, 165/60R14, 165/65R14, 185/55R14, 185/60R14
- 175/65R14, 175/70R14, 185/50R14, 185/55R14, 185/65R14
- 195/65R14, 175/80R14, 185/70R14

### 15" Tires - €30-35 (with mounting and balancing)
- 155/60R15, 165/65R15, 175/50R15, 175/55R15, 175/60R15
- 175/65R15, 185/55R15, 185/60R15, 185/65R15, 195/50R15
- 195/55R15, 195/60R15, 195/65R15, 205/55R15, 205/60R15
- 205/65R15, 215/65R15, 225/60R15, 225/75R15

### 16" Tires - €35-40 (with mounting and balancing)
- 185/55R16, 195/55R16, 205/50R16, 205/55R16, 215/55R16
- 225/55R16, 215/60R16, 215/65R16, 225/60R16, 195/45R16
- 195/50R16, 205/45R16, 225/45R16, 225/50R16, 215/45R16
- 195/60R16, 205/60R16, 195/65R16, 205/65R16, 215/60R16
- 215/65R16, 225/60R16, 235/55R16, 155/90R16, 205/70R16
- 215/65R16, 215/70R16, 225/65R16, 235/60R16, 215/75R16
- 225/70R16, 235/65R16, 255/60R16

### 17" Tires - €40-45 (with mounting and balancing)
- 195/45R17, 205/40R17, 215/40R17, 245/35R17, 205/45R17
- 215/45R17, 225/45R17, 235/40R17, 245/40R17, 205/50R17
- 205/55R17, 215/50R17, 225/50R17, 235/45R17, 245/45R17
- 255/40R17, 265/40R17, 215/55R17, 225/55R17, 235/50R17
- 245/50R17, 255/45R17, 215/60R17, 225/60R17, 235/55R17
- 245/55R17, 255/50R17

### 18" Tires - €40-50 (with mounting and balancing)
- 205/40R18, 225/40R18, 225/35R18, 245/35R18, 265/35R18
- 265/40R18, 285/30R18, 215/45R18, 225/40R18, 235/40R18
- 245/40R18, 255/35R18, 265/35R18, 275/35R18, 285/35R18
- 295/30R18, 225/45R18, 225/50R18, 235/45R18, 245/45R18
- 255/40R18, 265/40R18, 275/40R18, 215/55R18, 225/55R18
- 235/50R18, 245/50R18, 225/60R18, 235/55R18, 245/55R18
- 255/50R18, 265/50R18, 285/45R18, 295/45R18, 235/60R18
- 225/65R18, 245/60R18, 265/55R18

### 19" Tires - €50-55 (with mounting and balancing)
- 235/35R19, 245/35R19, 225/35R19, 255/30R19, 255/35R19
- 265/35R19, 265/50R19, 255/50R19, 255/55R19, 285/45R19
- 285/30R19, 245/40R19, 245/45R19, 255/40R19, 305/30R19
- 255/40R19, 285/45R19, 255/50R19, 255/55R19, 265/55R19
- 275/30R19, 275/40R19, 275/45R19, 235/55R19, 225/55R19
- 295/30R19, 305/30R19

### 20" Tires - €60-70 (with mounting and balancing)
- 225/30R20, 235/30R20, 245/30R20, 255/30R20, 245/35R20
- 255/30R20, 265/30R20, 275/30R20, 285/30R20, 295/30R20
- 305/25R20, 245/40R20, 255/35R20, 265/35R20, 265/30R20
- 275/30R20, 275/40R20, 285/35R20, 285/30R20, 295/30R20
- 315/35R20, 325/25R20

### 21" Tires - €60-70 (with mounting and balancing)
- 21 inch (generic size)

### Commercial Van Tires (C) - €40-50 (with mounting and balancing)
- 175/65R14C, 195/70R15C, 215/70R15C, 225/70R15C
- 225/65R16C, 235/65R16C, 205/65R16C, 215/65R16C
- 195/65R16C, 225/60R16C, 215/60R17C

## Running the Seeding Script

### Prerequisites
1. Ensure your database is running and accessible
2. Set up your `.env` file with the correct `DATABASE_URL`
3. Install dependencies: `npm install`

### Commands

#### Seed Ariana Banden Service Data
```bash
npm run seed:ariana
```

#### Seed Default Data (Original)
```bash
npm run seed
```

### What the Script Does

1. **Preserves existing data** - does not delete current products or categories
2. **Creates missing categories** if they don't exist:
   - Summer Tires (Zommer banden)
   - Winter Tires (Winter banden)
   - All-Season Tires (4seasons banden)
   - Commercial Tires (C of camionette banden)

3. **Adds new products** for each tire size (avoiding duplicates) with:
   - Random brand selection (Michelin, Goodyear, Continental, Bridgestone, Pirelli)
   - Realistic pricing based on the provided price list
   - Random stock levels (10-60 units)
   - Random ratings (4.0-5.0 stars)
   - 20% chance of being featured
   - Complete product specifications

4. **Creates product images** for new products with placeholder URLs
5. **Links new products to categories** appropriately
6. **Adds some products to multiple categories** (e.g., summer + all-season)

## Store Information

The data reflects Ariana Banden Service's business details:

- **Address**: Provinciebaan 192A, Ledegem 8880
- **Gent Address**: Dendermondseseenweg 428, Sint-Amandsberg 9040
- **Phone**: 0467662197
- **Email**: Amirjan.nikzad2020@gmail.com
- **Facebook**: Ledegem banden
- **Opening Hours**: 
  - Mon-Sat: 09:00-18:00
  - Sun: 10:00-16:00 (by appointment)

## Features Included

- **Mounting and balancing** included in all prices
- **Quality guarantee** on all products
- **Professional service** with experienced staff
- **Competitive pricing** with the best prices guaranteed
- **Wide range** of sizes from 13" to 21"
- **Tread depth** options from 5mm to 8mm

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check your `.env` file has the correct `DATABASE_URL`
   - Ensure your database is running

2. **Duplicate SKU Errors**
   - The script automatically checks for existing SKUs and skips duplicates
   - If you get errors, the products may already exist

3. **TypeScript Errors**
   - Run `npm install` to ensure all dependencies are installed
   - Check that your TypeScript version is compatible

### Data Preservation

The script is designed to preserve your existing data:
- **Existing products** are kept unchanged
- **Existing categories** are reused if they exist
- **New products** are added with unique SKUs
- **Duplicate prevention** ensures no conflicts

## Customization

You can modify the seeding script to:

- Add more tire sizes
- Adjust pricing
- Add more brands
- Modify product descriptions
- Change category assignments

The script is well-documented and modular for easy customization.

## Support

For issues with the seeding script, check:
1. Database connection settings
2. Environment variables
3. Dependencies installation
4. Database schema compatibility
