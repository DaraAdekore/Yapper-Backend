import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';

export const verifyToken = (token: string | undefined): JwtPayload => {
    try {
        if(!token) {
            throw new Error('Token is required');
        }
        return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (error) {
        throw new Error('Invalid token');
    }
};
