
'use server';

import { revalidatePath } from 'next/cache';
import { Client, ClientStatus, clientStatuses, productCategories, Comment, UserProfile, UserStatus, DashboardAnalyticsData, SellerAnalytics, AnalyticsPeriod, Group, RecentSale, MessageTemplate, SellerPerformanceData } from '@/lib/types';
import { z } from 'zod';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, Timestamp, orderBy, writeBatch, getDoc, limit } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { subDays, format, parseISO, startOfWeek, endOfWeek, subWeeks, isWithinInterval, startOfDay, endOfDay, startOfMonth, addDays, subHours, endOfMonth, subMonths, startOfYear, endOfYear, subYears, addMonths, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';


const formSchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
  city: z.string().min(2, "A cidade deve ter pelo menos 2 caracteres."),
  contact: z.string().min(5, "O contato parece muito curto."),
  lastProductBought: z.string().optional(),
  desiredProduct: z.enum(productCategories),
  status: z.enum(clientStatuses),
  remarketingReminder: z.string().optional(),
});

const BRAZIL_TIMEZONE_OFFSET = 3;


export async function getClients(userId: string): Promise<Client[]> {
  if (!userId) return [];
  if (!db) throw new Error("Firebase não está configurado.");
  
  const clientsRef = collection(db, 'clients');
  const q = query(clientsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);

  const clients = querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate().toISOString() : undefined,
    } as Client;
  });

  return clients;
}

export async function addClient(data: unknown, userId: string) {
  if (!userId) {
    return { error: { formErrors: ['Usuário não autenticado.'], fieldErrors: {} } };
  }
   if (!db) {
    return { error: { formErrors: ["Firebase não está configurado."], fieldErrors: {} } };
  }
  const result = formSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.flatten() };
  }

  const normalizedContact = result.data.contact.replace(/\D/g, '');
  if (!db) throw new Error("Firebase não configurado.");

  const clientsRef = collection(db, 'clients');
  const q = query(clientsRef, where('normalizedContact', '==', normalizedContact), limit(1));
  const querySnapshot = await getDocs(q);

  const now = Timestamp.now();
  const userDoc = await getDoc(doc(db, 'users', userId));
  const newOwnerName = userDoc.exists() ? userDoc.data().name : 'Vendedor';

  try {
    if (!querySnapshot.empty) {
      const existingClientDoc = querySnapshot.docs[0];
      const existingClientRef = doc(db, 'clients', existingClientDoc.id);
      const existingClientData = existingClientDoc.data();
      const ownerId = existingClientData.userId;

      if (ownerId === userId) {
        return { error: { formErrors: [], fieldErrors: { contact: ["Este contato já está na sua carteira de clientes."] } } };
      }

      const thirtyDaysAgo = subDays(new Date(), 30);
      const updatedAtDate = (existingClientData.updatedAt as Timestamp).toDate();

      if (updatedAtDate >= thirtyDaysAgo) {
        const ownerUserDoc = await getDoc(doc(db, 'users', ownerId));
        const ownerName = ownerUserDoc.exists() ? ownerUserDoc.data().name : 'outro vendedor';
        return { error: { formErrors: [], fieldErrors: { contact: [`Este lead pertence a ${ownerName} e foi atualizado recentemente.`] } } };
      }

      const batch = writeBatch(db);
      batch.update(existingClientRef, {
        userId: userId,
        updatedAt: now,
      });

      const commentText = `Lead transferido para ${newOwnerName}.`;
      const commentsRef = collection(db, 'clients', existingClientDoc.id, 'comments');
      batch.set(doc(commentsRef), {
        text: commentText,
        userId: 'system',
        createdAt: now,
        isSystemMessage: true,
      });

      await batch.commit();

      const updatedDocSnapshot = await getDoc(existingClientRef);
      const clientData = updatedDocSnapshot.data();

      revalidatePath('/');
      return {
        success: true,
        transferred: true,
        client: {
          id: updatedDocSnapshot.id,
          ...clientData,
          createdAt: (clientData?.createdAt as Timestamp).toDate().toISOString(),
          updatedAt: (clientData?.updatedAt as Timestamp).toDate().toISOString(),
        } as Client
      };
    } else {
      const batch = writeBatch(db);
      const newClientRef = doc(clientsRef);

      const newClientData = {
        ...result.data,
        userId,
        normalizedContact,
        lastProductBought: result.data.lastProductBought || '',
        remarketingReminder: result.data.remarketingReminder || '',
        createdAt: now,
        updatedAt: now,
      };

      batch.set(newClientRef, newClientData);

      const commentText = `Lead criado por ${newOwnerName}.`;
      const commentsRef = collection(db, 'clients', newClientRef.id, 'comments');
      batch.set(doc(commentsRef), {
        text: commentText,
        userId: 'system',
        createdAt: now,
        isSystemMessage: true,
      });

      await batch.commit();

      revalidatePath('/');
      return { 
          success: true,
          transferred: false, 
          client: {
              id: newClientRef.id,
              ...newClientData,
              createdAt: now.toDate().toISOString(),
              updatedAt: now.toDate().toISOString(),
          } as Client
      };
    }
  } catch (e: any) {
    return { error: { formErrors: [e.message || 'Erro ao adicionar cliente no banco de dados.'], fieldErrors: {} } };
  }
}

export async function addBulkClients(clientsData: any[], userId: string) {
  if (!userId) {
    return { success: false, errors: ['Usuário não autenticado.'], addedClients: [] };
  }
  if (!clientsData || clientsData.length === 0) {
    return { success: false, errors: ['Nenhum dado de cliente fornecido.'], addedClients: [] };
  }
   if (!db) {
    return { success: false, errors: ["Firebase não está configurado."], addedClients: [] };
  }

  const batch = writeBatch(db);
  const clientsRef = collection(db, 'clients');
  const addedClients: Client[] = [];
  const finalErrors: string[] = [];

  const contactsInFile = new Set();
  const duplicateContactsInFile: string[] = [];
  for (const clientData of clientsData) {
      const normalizedContact = (clientData.contact || "").replace(/\D/g, '');
      if (normalizedContact && contactsInFile.has(normalizedContact)) {
          duplicateContactsInFile.push(clientData.contact);
      }
      if(normalizedContact) contactsInFile.add(normalizedContact);
  }

  if (duplicateContactsInFile.length > 0) {
      finalErrors.push(`O arquivo contém contatos duplicados: ${[...new Set(duplicateContactsInFile)].join(', ')}. Remova as duplicatas e tente novamente.`);
      return { success: false, errors: finalErrors, addedClients: [] };
  }

  for (const [index, clientData] of clientsData.entries()) {
    const normalizedContact = (clientData.contact || "").replace(/\D/g, '');
    
    if (!clientData.name || !clientData.city || !normalizedContact) {
        finalErrors.push(`Linha ${index + 2}: Nome, Cidade e Contato são obrigatórios.`);
        continue;
    }

    const q = query(clientsRef, where('normalizedContact', '==', normalizedContact), limit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        finalErrors.push(`Linha ${index + 2}: Contato ${clientData.contact} já existe no sistema e foi ignorado.`);
        continue; 
    }

    const now = Timestamp.now();
    const newClientData = {
      ...clientData,
      userId,
      normalizedContact,
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = doc(clientsRef);
    batch.set(docRef, newClientData);

    addedClients.push({
      id: docRef.id,
      ...newClientData,
      createdAt: newClientData.createdAt.toDate().toISOString(),
      updatedAt: newClientData.updatedAt.toDate().toISOString(),
    } as Client);
  }

  try {
    if(addedClients.length > 0) {
      await batch.commit();
    }
    revalidatePath('/');
    return { success: true, errors: finalErrors, addedClients };
  } catch (e: any) {
    return { success: false, errors: [...finalErrors, e.message || 'Erro ao adicionar clientes em massa.'], addedClients: [] };
  }
}

export async function updateClient(id: string, data: unknown, userId: string) {
    if (!userId) {
        return { error: { formErrors: ['Usuário não autenticado.'], fieldErrors: {} } };
    }
    if (!db) {
        return { error: { formErrors: ["Firebase não está configurado."], fieldErrors: {} } };
    }
    const result = formSchema.safeParse(data);
    if (!result.success) {
        return { error: result.error.flatten() };
    }

    const normalizedContact = result.data.contact.replace(/\D/g, '');
    const clientsRef = collection(db, 'clients');
    const q = query(clientsRef, where('normalizedContact', '==', normalizedContact));
    const querySnapshot = await getDocs(q);
    const conflictingClient = querySnapshot.docs.find(doc => doc.id !== id);

    if (conflictingClient) {
        return { error: { formErrors: [], fieldErrors: { contact: ["Este número de contato já está em uso por outro cliente."] } } };
    }

    try {
        const clientDocRef = doc(db, 'clients', id);
        const now = Timestamp.now();
        await updateDoc(clientDocRef, {
            ...result.data,
            normalizedContact,
            updatedAt: now,
        });
        
        revalidatePath('/');
        
        const clientDoc = await getDoc(clientDocRef);
        const existingData = clientDoc.data();

        const updatedClientData = {
          ...existingData,
          id: id,
          userId,
          ...result.data,
          lastProductBought: result.data.lastProductBought || '',
          remarketingReminder: result.data.remarketingReminder || '',
          createdAt: (existingData?.createdAt as Timestamp).toDate().toISOString(),
          updatedAt: now.toDate().toISOString(),
        }
        return { success: true, client: updatedClientData as Client };

    } catch(e: any) {
        return { error: { formErrors: [e.message || 'Erro ao atualizar cliente.'], fieldErrors: {} } };
    }
}

export async function updateClientStatus(id: string, status: ClientStatus, userId: string, saleValue?: number) {
    if (!userId) {
        return { error: 'Usuário não autenticado' };
    }
    if (!db) {
        return { error: "Firebase não está configurado." };
    }
    try {
        const clientDocRef = doc(db, 'clients', id);
        const clientDoc = await getDoc(clientDocRef);

        if (!clientDoc.exists()) {
            return { error: 'Cliente não encontrado.' };
        }
        const previousStatus = clientDoc.data().status;
        const now = Timestamp.now();
        const batch = writeBatch(db);

        if (status === 'Fechado' && previousStatus !== 'Fechado') {
             if (typeof saleValue !== 'number' || saleValue <= 0) {
                return { error: 'Valor da venda é inválido ou não foi fornecido.' };
            }
            const salesRef = collection(db, 'sales');
            const saleDocRef = doc(salesRef);
            batch.set(saleDocRef, {
                clientId: id,
                userId: userId,
                saleDate: now,
                saleValue: saleValue,
            });

            const commentText = `Venda registrada no valor de ${saleValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`;
            const commentsRef = collection(db, 'clients', id, 'comments');
            const commentDocRef = doc(commentsRef);
            batch.set(commentDocRef, {
                text: commentText,
                userId: "system",
                isSystemMessage: true,
                createdAt: now,
            });
        }
        
        batch.update(clientDocRef, { 
          status: status,
          updatedAt: now
        });

        await batch.commit();
        
        revalidatePath('/');
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Erro ao atualizar status.' };
    }
}


export async function deleteClient(id: string, userId: string) {
    if (!userId) {
        return { error: 'Usuário não autenticado' };
    }
     if (!db) {
        return { error: "Firebase não está configurado." };
    }
    try {
        const clientDocRef = doc(db, 'clients', id);
        await deleteDoc(clientDocRef);
        revalidatePath('/');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Erro ao deletar cliente.' };
    }
}

export async function getComments(clientId: string, userId: string): Promise<Comment[]> {
  if (!userId || !clientId) return [];
  if (!db) throw new Error("Firebase não está configurado.");
  
  const commentsRef = collection(db, 'clients', clientId, 'comments');
  const q = query(commentsRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);

  const commentDocs = querySnapshot.docs;
  const userIds = [...new Set(commentDocs.map(doc => doc.data().userId).filter(id => id !== 'system'))];

  const userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const usersRef = collection(db, 'users');
    const usersQuery = query(usersRef, where('__name__', 'in', userIds));
    const usersSnapshot = await getDocs(usersQuery);
    usersSnapshot.forEach(doc => userMap.set(doc.id, doc.data().name));
  }

  const comments = commentDocs.map(doc => {
    const data = doc.data();
    const commenterId = data.userId;
    const userName = commenterId === 'system' 
        ? 'Sistema' 
        : userMap.get(commenterId) || 'Usuário Deletado';

    return {
      id: doc.id,
      text: data.text,
      userId: commenterId,
      userName,
      isSystemMessage: data.isSystemMessage || false,
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
    } as Comment;
  });

  return comments;
}

export async function addComment(clientId: string, text: string, userId: string) {
  if (!userId) {
    return { success: false, error: 'Usuário não autenticado.' };
  }
  if (!text.trim()) {
    return { success: false, error: 'O texto da observação não pode estar vazio.' };
  }
  if (!db) {
    return { success: false, error: "Firebase não está configurado." };
  }

  try {
    const batch = writeBatch(db);
    const clientDocRef = doc(db, 'clients', clientId);
    const commentsRef = collection(db, 'clients', clientId, 'comments');
    const newCommentRef = doc(commentsRef);
    const now = Timestamp.now();

    const newCommentData = {
      text,
      userId,
      createdAt: now,
      isSystemMessage: false,
    };
    batch.set(newCommentRef, newCommentData);
    batch.update(clientDocRef, { updatedAt: now });

    await batch.commit();

    const userDoc = await getDoc(doc(db, 'users', userId));
    const userName = userDoc.exists() ? userDoc.data().name : 'Usuário';

    return { 
        success: true, 
        comment: {
            id: newCommentRef.id,
            ...newCommentData,
            userName,
            createdAt: newCommentData.createdAt.toDate().toISOString(),
        } as Comment
    };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao adicionar observação.' };
  }
}

async function isAdmin(userId: string): Promise<boolean> {
    if (!db) return false;
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    return userDoc.exists() && userDoc.data().role === 'admin';
}

export async function getUsersForAdmin(adminId: string, groupId: string | null = null): Promise<UserProfile[]> {
  if (!adminId) {
    throw new Error('Usuário não autenticado.');
  }
  if (!db) {
    throw new Error('Firebase não está configurado.');
  }

  const userIsAdmin = await isAdmin(adminId);
  if (!userIsAdmin) {
    throw new Error('Acesso negado. Apenas administradores podem ver a lista de usuários.');
  }

  const usersRef = collection(db, 'users');
  let q;

  if (groupId) {
    q = query(usersRef, where('groupId', '==', groupId), orderBy('createdAt', 'desc'));
  } else {
    q = query(usersRef, orderBy('createdAt', 'desc'));
  }

  const querySnapshot = await getDocs(q);

  const users = querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      email: data.email,
      role: data.role,
      status: data.status || 'active',
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      groupId: data.groupId || undefined,
    } as UserProfile;
  });

  return users;
}

export async function updateUserRole(userIdToUpdate: string, newRole: 'vendedor' | 'admin', adminId: string) {
  if (!db) return { success: false, error: "Firebase não configurado." };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado. Ação permitida apenas para administradores.' };
  }
  
  try {
    const userDocRef = doc(db, 'users', userIdToUpdate);
    await updateDoc(userDocRef, { role: newRole });
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch(e: any) {
    return { success: false, error: e.message || "Erro ao atualizar a função do usuário." };
  }
}

export async function updateUserStatus(userIdToUpdate: string, newStatus: UserStatus, adminId: string) {
  if (!db) return { success: false, error: "Firebase não configurado." };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado. Ação permitida apenas para administradores.' };
  }
  
  try {
    const userDocRef = doc(db, 'users', userIdToUpdate);
    await updateDoc(userDocRef, { status: newStatus });
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch(e: any) {
    return { success: false, error: e.message || "Erro ao atualizar o status do usuário." };
  }
}

export async function sendPasswordResetForUser(email: string, adminId: string) {
  if (!auth) return { success: false, error: 'Firebase Auth não configurado.' };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado. Ação permitida apenas para administradores.' };
  }

  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Erro ao enviar e-mail de redefinição de senha." };
  }
}

export async function deleteUserRecord(userIdToDelete: string, adminId: string) {
  if (!db) return { success: false, error: "Firebase não configurado." };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado. Ação permitida apenas para administradores.' };
  }

  try {
    await deleteDoc(doc(db, "users", userIdToDelete));
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Erro ao deletar registro do usuário." };
  }
}

export async function getDashboardAnalytics(adminId: string, period: 'weekly' | 'monthly' | 'yearly' = 'weekly', groupId: string | null = null): Promise<DashboardAnalyticsData> {
  if (!db) throw new Error('Firebase não está configurado.');
  if (!await isAdmin(adminId)) {
    throw new Error('Acesso negado.');
  }

  const [usersSnapshot, allClientsSnapshot, allSalesSnapshot, groupsSnapshot] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'clients')),
    getDocs(collection(db, 'sales')),
    getDocs(collection(db, 'groups')),
  ]);

  const allUsers = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<UserProfile, 'id'>),
      groupId: doc.data().groupId,
  }));
  
  const groupIdToNameMap = new Map(groupsSnapshot.docs.map(doc => [doc.id, doc.data().name]));

  let userIdsInGroup: string[] | null = null;
  if (groupId) {
    userIdsInGroup = allUsers.filter(u => u.groupId === groupId).map(u => u.id);
  }

  const clients = allClientsSnapshot.docs
    .filter(doc => userIdsInGroup ? userIdsInGroup.includes(doc.data().userId) : true)
    .map(docInst => {
      const data = docInst.data();
      return {
        id: docInst.id,
        ...data,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }
  });

  const sales = allSalesSnapshot.docs
    .filter(doc => userIdsInGroup ? userIdsInGroup.includes(doc.data().userId) : true)
    .map(docInst => {
      const data = docInst.data();
      return {
        id: docInst.id,
        userId: data.userId,
        saleDate: (data.saleDate as Timestamp).toDate(),
        saleValue: data.saleValue || 0,
      };
    });

  const userIdToDataMap = new Map(allUsers.map(u => [u.id, { name: u.name, groupId: u.groupId }]));
  
  const thirtyDaysAgoForAbandoned = subDays(new Date(), 30);
  
  const abandonedLeadsCount = clients.filter(client => {
    const status = client.status as ClientStatus;
    const isPotentiallyAbandonable = status === 'Novo Lead' || status === 'Em negociação';
    if (!isPotentiallyAbandonable) {
        return false;
    }
    if (!client.updatedAt) {
      return false;
    }
    const updatedAtDate = (client.updatedAt as Timestamp).toDate();
    return updatedAtDate < thirtyDaysAgoForAbandoned;
  }).length;


  const now = subHours(new Date(), BRAZIL_TIMEZONE_OFFSET);
  
  let startOfCurrentPeriod: Date, endOfCurrentPeriod: Date, startOfPreviousPeriod: Date, endOfPreviousPeriod: Date;

  if (period === 'weekly') {
    startOfCurrentPeriod = startOfWeek(now, { weekStartsOn: 1 });
    endOfCurrentPeriod = endOfWeek(now, { weekStartsOn: 1 });
    startOfPreviousPeriod = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    endOfPreviousPeriod = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  } else if (period === 'monthly') {
    startOfCurrentPeriod = startOfMonth(now);
    endOfCurrentPeriod = endOfMonth(now);
    startOfPreviousPeriod = startOfMonth(subMonths(now, 1));
    endOfPreviousPeriod = endOfMonth(subMonths(now, 1));
  } else { // yearly
    startOfCurrentPeriod = startOfYear(now);
    endOfCurrentPeriod = endOfYear(now);
    startOfPreviousPeriod = startOfYear(subYears(now, 1));
    endOfPreviousPeriod = endOfYear(subYears(now, 1));
  }


  let leadsThisPeriodCount = 0;
  let leadsLastPeriodCount = 0;

  clients.forEach(client => {
    const createdAtDate = (client.createdAt as Timestamp).toDate();
    if (isWithinInterval(createdAtDate, { start: startOfCurrentPeriod, end: endOfCurrentPeriod })) {
      leadsThisPeriodCount++;
    } else if (isWithinInterval(createdAtDate, { start: startOfPreviousPeriod, end: endOfPreviousPeriod })) {
      leadsLastPeriodCount++;
    }
  });

  const salesThisPeriod = sales.filter(sale =>
    isWithinInterval(sale.saleDate, { start: startOfCurrentPeriod, end: endOfCurrentPeriod })
  );
  const salesLastPeriod = sales.filter(sale =>
    isWithinInterval(sale.saleDate, { start: startOfPreviousPeriod, end: endOfPreviousPeriod })
  );

  const salesThisPeriodCount = salesThisPeriod.length;
  const salesLastPeriodCount = salesLastPeriod.length;
  
  const revenueThisPeriod = salesThisPeriod.reduce((sum, sale) => sum + sale.saleValue, 0);
  const revenueLastPeriod = salesLastPeriod.reduce((sum, sale) => sum + sale.saleValue, 0);
  
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const leads = {
    count: leadsThisPeriodCount,
    change: calculateChange(leadsThisPeriodCount, leadsLastPeriodCount),
  };
  const salesData = {
    count: salesThisPeriodCount,
    change: calculateChange(salesThisPeriodCount, salesLastPeriodCount),
  };
  const revenue = {
    total: revenueThisPeriod,
    change: calculateChange(revenueThisPeriod, revenueLastPeriod),
  };
  
  const conversionRateThisPeriod = leadsThisPeriodCount > 0 ? (salesThisPeriodCount / leadsThisPeriodCount) * 100 : 0;
  const conversionRateLastPeriod = leadsLastPeriodCount > 0 ? (salesLastPeriodCount / leadsLastPeriodCount) * 100 : 0;
  
  const conversionRate = {
    rate: conversionRateThisPeriod,
    change: calculateChange(conversionRateThisPeriod, conversionRateLastPeriod)
  };

  const thirtyDaysAgo = startOfDay(subDays(now, 29));
  const today = endOfDay(now);
  
  const performanceMap: Map<string, { leads: number; sales: number }> = new Map();

  for (let d = thirtyDaysAgo; d <= today; d = addDays(d, 1)) {
    const dateStr = format(d, 'yyyy-MM-dd');
    performanceMap.set(dateStr, { leads: 0, sales: 0 });
  }

  clients.forEach(client => {
    const createdAtDate = (client.createdAt as Timestamp).toDate();
    if (isWithinInterval(createdAtDate, { start: thirtyDaysAgo, end: today })) {
      const adjustedDate = subHours(createdAtDate, BRAZIL_TIMEZONE_OFFSET);
      const dateStr = format(adjustedDate, 'yyyy-MM-dd');
      if (performanceMap.has(dateStr)) {
        performanceMap.get(dateStr)!.leads += 1;
      }
    }
  });

  sales.forEach(sale => {
    if (isWithinInterval(sale.saleDate, { start: thirtyDaysAgo, end: today })) {
      const adjustedDate = subHours(sale.saleDate, BRAZIL_TIMEZONE_OFFSET);
      const dateStr = format(adjustedDate, 'yyyy-MM-dd');
      if (performanceMap.has(dateStr)) {
        performanceMap.get(dateStr)!.sales += 1;
      }
    }
  });

  const performanceOverTime = Array.from(performanceMap.entries())
    .map(([date, data]) => ({
      fullDate: date,
      leads: data.leads,
      sales: data.sales,
    }))
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
    .map(({ fullDate, leads, sales }) => ({
      date: format(parseISO(fullDate), 'dd/MM'),
      leads,
      sales,
    }));

  const salesBySeller: { [key: string]: { sales: number; revenue: number; } } = {};
  sales.forEach(sale => {
    if (sale.userId) {
       if (!salesBySeller[sale.userId]) {
        salesBySeller[sale.userId] = { sales: 0, revenue: 0 };
      }
      salesBySeller[sale.userId].sales += 1;
      salesBySeller[sale.userId].revenue += sale.saleValue;
    }
  });

  const salesRanking = Object.entries(salesBySeller)
    .map(([userId, data]) => {
      const userData = userIdToDataMap.get(userId);
      const groupName = userData?.groupId ? groupIdToNameMap.get(userData.groupId) : undefined;
      return {
        sellerId: userId,
        sellerName: userData?.name || 'Vendedor Deletado',
        groupName: groupName || 'Sem Grupo',
        sales: data.sales,
        revenue: data.revenue,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
    
  return {
    leads,
    sales: salesData,
    revenue,
    conversionRate,
    abandonedLeadsCount,
    performanceOverTime,
    salesRanking,
  };
}

export async function getSellerAnalytics(adminId: string, period: AnalyticsPeriod = 'total', groupId: string | null = null): Promise<SellerAnalytics[]> {
  if (!db) throw new Error('Firebase não está configurado.');
  if (!await isAdmin(adminId)) {
    throw new Error('Acesso negado.');
  }

  const usersRef = collection(db, 'users');
  let usersQuery;
  if (groupId) {
    usersQuery = query(usersRef, where('role', '==', 'vendedor'), where('groupId', '==', groupId));
  } else {
    usersQuery = query(usersRef, where('role', '==', 'vendedor'));
  }

  const [usersSnapshot, allClientsSnapshot, allSalesSnapshot] = await Promise.all([
    getDocs(usersQuery),
    getDocs(collection(db, 'clients')),
    getDocs(query(collection(db, 'sales'), orderBy('saleDate', 'asc'))),
  ]);

  const sellers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Omit<UserProfile, 'id'> }));
  
  const allClientsData = allClientsSnapshot.docs.map(docInst => ({
    id: docInst.id,
    ...(docInst.data() as Omit<Client, 'id' | 'createdAt'>),
    createdAt: (docInst.data().createdAt as Timestamp).toDate(),
    userId: docInst.data().userId,
    status: docInst.data().status as ClientStatus,
  }));

  const allSalesData = allSalesSnapshot.docs.map(docInst => {
    const data = docInst.data();
    return {
      id: docInst.id,
      userId: data.userId,
      clientId: data.clientId,
      saleDate: (data.saleDate as Timestamp).toDate(),
      saleValue: data.saleValue || 0,
    };
  });
  
  const clientFirstPurchase = new Set<string>();
  const repurchaseSaleIds = new Set<string>();
  allSalesData.forEach(sale => {
    if (clientFirstPurchase.has(sale.clientId)) {
      repurchaseSaleIds.add(sale.id);
    } else {
      clientFirstPurchase.add(sale.clientId);
    }
  });

  const now = subHours(new Date(), BRAZIL_TIMEZONE_OFFSET);
  let startDate: Date;
  let endDate: Date;

  if (period !== 'total') {
    switch (period) {
      case 'daily':
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case 'weekly':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'monthly':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'yearly':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
    }
  }

  const clients = period === 'total'
    ? allClientsData
    : allClientsData.filter(client => isWithinInterval(client.createdAt, { start: startDate, end: endDate }));

  const sales = period === 'total'
    ? allSalesData
    : allSalesData.filter(sale => isWithinInterval(sale.saleDate, { start: startDate, end: endDate }));

  const analyticsMap: Map<string, SellerAnalytics> = new Map();

  sellers.forEach(seller => {
    analyticsMap.set(seller.id, {
      sellerId: seller.id,
      sellerName: seller.name,
      totalLeads: 0,
      totalSales: 0,
      totalRevenue: 0,
      totalRepurchases: 0,
      leadsByStatus: { "Novo Lead": 0, "Em negociação": 0, "Fechado": 0, "Pós-venda": 0 },
      conversionRate: 0,
      performanceOverTime: [],
    });
  });

  clients.forEach(client => {
    if (client.userId && analyticsMap.has(client.userId)) {
      const sellerAnalytics = analyticsMap.get(client.userId)!;
      sellerAnalytics.totalLeads += 1;
      if (client.status) {
        sellerAnalytics.leadsByStatus[client.status] = (sellerAnalytics.leadsByStatus[client.status] || 0) + 1;
      }
    }
  });

  sales.forEach(sale => {
    if (sale.userId && analyticsMap.has(sale.userId)) {
      const sellerAnalytics = analyticsMap.get(sale.userId)!;
      sellerAnalytics.totalSales += 1;
      sellerAnalytics.totalRevenue += sale.saleValue;
      if (repurchaseSaleIds.has(sale.id)) {
        sellerAnalytics.totalRepurchases += 1;
      }
    }
  });
  
  // -- Chart data calculation --
  let chartStartDate: Date;
  const chartEndDate: Date = endOfDay(now);
  let chartLabelFormat: string;
  let chartDateKeyFormat: string;
  const performanceMapTemplate: Map<string, { leads: number; sales: number }> = new Map();

  if (period === 'yearly') {
    chartStartDate = startOfYear(now);
    chartLabelFormat = 'MMM';
    chartDateKeyFormat = 'yyyy-MM';
    for (let i = 0; i < 12; i++) {
      const monthDate = startOfMonth(addMonths(chartStartDate, i));
      if (isAfter(monthDate, chartEndDate)) break;
      performanceMapTemplate.set(format(monthDate, chartDateKeyFormat), { leads: 0, sales: 0 });
    }
  } else if (period === 'monthly') {
    chartStartDate = startOfMonth(now);
    chartLabelFormat = 'dd';
    chartDateKeyFormat = 'yyyy-MM-dd';
    for (let d = new Date(chartStartDate); d <= chartEndDate; d = addDays(d, 1)) {
      performanceMapTemplate.set(format(d, chartDateKeyFormat), { leads: 0, sales: 0 });
    }
  } else if (period === 'weekly' || period === 'daily') {
    chartStartDate = startOfWeek(now, { weekStartsOn: 1 });
    const endOfWeekDate = endOfWeek(now, { weekStartsOn: 1 });
    chartLabelFormat = 'dd/MM';
    chartDateKeyFormat = 'yyyy-MM-dd';
    for (let d = new Date(chartStartDate); d <= endOfWeekDate; d = addDays(d, 1)) {
      if (isAfter(d, chartEndDate)) break; // Don't show future days.
      performanceMapTemplate.set(format(d, chartDateKeyFormat), { leads: 0, sales: 0 });
    }
  } else { // 'total'
    chartStartDate = startOfDay(subDays(now, 29));
    chartLabelFormat = 'dd/MM';
    chartDateKeyFormat = 'yyyy-MM-dd';
    for (let d = new Date(chartStartDate); d <= chartEndDate; d = addDays(d, 1)) {
      performanceMapTemplate.set(format(d, chartDateKeyFormat), { leads: 0, sales: 0 });
    }
  }

  const clientsForChart = allClientsData.filter(c => isWithinInterval(c.createdAt, { start: chartStartDate, end: chartEndDate }));
  const salesForChart = allSalesData.filter(s => isWithinInterval(s.saleDate, { start: chartStartDate, end: chartEndDate }));

  analyticsMap.forEach(sellerAnalytics => {
    // Deep copy the template map for each seller
    const performanceMap: Map<string, { leads: number; sales: number }> =
      new Map(JSON.parse(JSON.stringify(Array.from(performanceMapTemplate))));

    clientsForChart
      .filter(c => c.userId === sellerAnalytics.sellerId)
      .forEach(client => {
        const adjustedDate = subHours(client.createdAt, BRAZIL_TIMEZONE_OFFSET);
        const dateStr = format(adjustedDate, chartDateKeyFormat);
        if (performanceMap.has(dateStr)) {
          performanceMap.get(dateStr)!.leads += 1;
        }
      });

    salesForChart
      .filter(s => s.userId === sellerAnalytics.sellerId)
      .forEach(sale => {
        const adjustedDate = subHours(sale.saleDate, BRAZIL_TIMEZONE_OFFSET);
        const dateStr = format(adjustedDate, chartDateKeyFormat);
        if (performanceMap.has(dateStr)) {
          performanceMap.get(dateStr)!.sales += 1;
        }
      });

    sellerAnalytics.performanceOverTime = Array.from(performanceMap.entries())
      .map(([date, data]) => ({ fullDate: date, ...data }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
      .map(({ fullDate, leads, sales }) => ({
        date: format(parseISO(fullDate.length === 7 ? `${fullDate}-01` : fullDate), chartLabelFormat, { locale: ptBR }),
        leads,
        sales
      }));
    
    sellerAnalytics.conversionRate = sellerAnalytics.totalLeads > 0
      ? (sellerAnalytics.totalSales / sellerAnalytics.totalLeads) * 100
      : 0;
  });

  const result: SellerAnalytics[] = Array.from(analyticsMap.values());
  return result.sort((a, b) => b.totalSales - a.totalSales);
}

export async function getSellerPerformanceData(userId: string, period: 'yearly' | 'monthly' | 'weekly' = 'monthly'): Promise<SellerPerformanceData> {
  if (!userId || !db) {
    throw new Error('Usuário ou conexão com o banco de dados inválida.');
  }

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const now = subHours(new Date(), BRAZIL_TIMEZONE_OFFSET);
  
  let startOfCurrentPeriod: Date, endOfCurrentPeriod: Date, startOfPreviousPeriod: Date, endOfPreviousPeriod: Date;

  if (period === 'weekly') {
    startOfCurrentPeriod = startOfWeek(now, { weekStartsOn: 1 });
    endOfCurrentPeriod = endOfWeek(now, { weekStartsOn: 1 });
    startOfPreviousPeriod = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    endOfPreviousPeriod = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  } else if (period === 'yearly') {
    startOfCurrentPeriod = startOfYear(now);
    endOfCurrentPeriod = endOfYear(now);
    startOfPreviousPeriod = startOfYear(subYears(now, 1));
    endOfPreviousPeriod = endOfYear(subYears(now, 1));
  } else { // monthly
    startOfCurrentPeriod = startOfMonth(now);
    endOfCurrentPeriod = endOfMonth(now);
    startOfPreviousPeriod = startOfMonth(subMonths(now, 1));
    endOfPreviousPeriod = endOfMonth(subMonths(now, 1));
  }

  const [usersSnapshot, allClientsSnapshot, allSalesSnapshot, groupsSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('role', '==', 'vendedor'))),
    getDocs(collection(db, 'clients')),
    getDocs(collection(db, 'sales')),
    getDocs(collection(db, 'groups'))
  ]);

  const allSellers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<UserProfile, 'id'>) }));
  const currentUser = allSellers.find(s => s.id === userId);
  const groupNameMap = new Map(groupsSnapshot.docs.map(doc => [doc.id, doc.data().name]));

  const allClients = allClientsSnapshot.docs.map(doc => ({ ...doc.data() as Omit<Client, 'createdAt'>, id: doc.id, createdAt: (doc.data().createdAt as Timestamp).toDate(), userId: doc.data().userId }));
  const allSales = allSalesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, saleDate: (doc.data().saleDate as Timestamp).toDate() }));

  const clientsThisPeriod = allClients.filter(c => isWithinInterval(c.createdAt, { start: startOfCurrentPeriod, end: endOfCurrentPeriod }));
  const salesThisPeriod = allSales.filter(s => isWithinInterval(s.saleDate, { start: startOfCurrentPeriod, end: endOfCurrentPeriod }));

  const clientsLastPeriod = allClients.filter(c => isWithinInterval(c.createdAt, { start: startOfPreviousPeriod, end: endOfPreviousPeriod }));
  const salesLastPeriod = allSales.filter(s => isWithinInterval(s.saleDate, { start: startOfPreviousPeriod, end: endOfPreviousPeriod }));

  const personalLeadsThis = clientsThisPeriod.filter(lead => lead.userId === userId).length;
  const personalSalesThis = salesThisPeriod.filter(sale => sale.userId === userId);
  const personalSalesCountThis = personalSalesThis.length;
  const personalRevenueThis = personalSalesThis.reduce((sum, sale) => sum + (sale.saleValue || 0), 0);
  const personalConversionRateThis = personalLeadsThis > 0 ? (personalSalesCountThis / personalLeadsThis) * 100 : 0;

  const personalLeadsLast = clientsLastPeriod.filter(lead => lead.userId === userId).length;
  const personalSalesLast = salesLastPeriod.filter(sale => sale.userId === userId);
  const personalSalesCountLast = personalSalesLast.length;
  const personalRevenueLast = personalSalesLast.reduce((sum, sale) => sum + (sale.saleValue || 0), 0);
  const personalConversionRateLast = personalLeadsLast > 0 ? (personalSalesCountLast / personalLeadsLast) * 100 : 0;

  const personalStats = {
    revenue: { total: personalRevenueThis, change: calculateChange(personalRevenueThis, personalRevenueLast) },
    leads: { count: personalLeadsThis, change: calculateChange(personalLeadsThis, personalLeadsLast) },
    sales: { count: personalSalesCountThis, change: calculateChange(personalSalesCountThis, personalSalesCountLast) },
    conversionRate: { rate: personalConversionRateThis, change: calculateChange(personalConversionRateThis, personalConversionRateLast) },
  };

  const sellerStatsMap = new Map<string, { sellerName: string; groupId?: string; totalSales: number; totalRevenue: number }>();
  allSellers.forEach(seller => sellerStatsMap.set(seller.id, { sellerName: seller.name, groupId: seller.groupId, totalSales: 0, totalRevenue: 0 }));

  salesThisPeriod.forEach(sale => {
    if (sellerStatsMap.has(sale.userId)) {
      const stats = sellerStatsMap.get(sale.userId)!;
      stats.totalSales += 1;
      stats.totalRevenue += (sale.saleValue || 0);
    }
  });
  
  const sortFn = (a: any, b: any) => b.totalRevenue - a.totalRevenue || b.totalSales - a.totalSales;

  const generalRanking = Array.from(sellerStatsMap.entries()).map(([sellerId, data]) => ({
    sellerId,
    sellerName: data.sellerName,
    totalSales: data.totalSales,
    totalRevenue: data.totalRevenue,
  })).sort(sortFn);

  let groupRanking: SellerPerformanceData['groupRanking'] = null;
  if (currentUser?.groupId) {
    groupRanking = Array.from(sellerStatsMap.entries())
      .filter(([, data]) => data.groupId === currentUser.groupId)
      .map(([sellerId, data]) => ({
        sellerId,
        sellerName: data.sellerName,
        totalSales: data.totalSales,
        totalRevenue: data.totalRevenue,
      }))
      .sort(sortFn);
  }

  return {
    personalStats,
    generalRanking,
    groupRanking,
    groupName: currentUser?.groupId ? groupNameMap.get(currentUser.groupId) : undefined,
    period,
  };
}


export async function updateUserGroup(userIdToUpdate: string, groupId: string | null, adminId: string) {
  if (!db) return { success: false, error: "Firebase não configurado." };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado. Ação permitida apenas para administradores.' };
  }
  
  try {
    const userDocRef = doc(db, 'users', userIdToUpdate);
    await updateDoc(userDocRef, { groupId: groupId });
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch(e: any) {
    return { success: false, error: e.message || "Erro ao atribuir grupo ao usuário." };
  }
}

export async function getGroups(adminId: string): Promise<Group[]> {
  if (!adminId) throw new Error('Usuário não autenticado.');
  if (!db) throw new Error('Firebase não está configurado.');
  if (!await isAdmin(adminId)) throw new Error('Acesso negado.');

  const [groupsSnapshot, usersSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'groups'), where('adminId', '==', adminId), orderBy('name'))),
    getDocs(collection(db, 'users'))
  ]);

  const users = usersSnapshot.docs.map(doc => doc.data());
  const groupCounts = users.reduce((acc, user) => {
    if (user.groupId) {
      acc[user.groupId] = (acc[user.groupId] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return groupsSnapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name,
    memberCount: groupCounts[doc.id] || 0,
  }));
}

const groupNameSchema = z.object({
    name: z.string().min(2, "O nome do grupo deve ter pelo menos 2 caracteres.")
});

export async function createGroup(name: string, adminId: string) {
  if (!db) return { success: false, error: "Firebase não configurado." };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado.' };
  }

  const result = groupNameSchema.safeParse({ name });
  if (!result.success) {
    return { success: false, error: result.error.flatten().fieldErrors.name?.join(', ') };
  }

  try {
    const docRef = await addDoc(collection(db, 'groups'), {
      name,
      adminId,
      createdAt: Timestamp.now(),
    });
    revalidatePath('/admin/dashboard');
    return { success: true, group: { id: docRef.id, name } as Group };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao criar grupo.' };
  }
}

export async function updateGroup(groupId: string, name: string, adminId: string) {
  if (!db) return { success: false, error: "Firebase não configurado." };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado.' };
  }

  const result = groupNameSchema.safeParse({ name });
  if (!result.success) {
    return { success: false, error: result.error.flatten().fieldErrors.name?.join(', ') };
  }

  try {
    const groupDocRef = doc(db, 'groups', groupId);
    await updateDoc(groupDocRef, { name });
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao atualizar grupo.' };
  }
}

export async function deleteGroup(groupId: string, adminId: string) {
  if (!db) return { success: false, error: "Firebase não configurado." };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado.' };
  }

  try {
    const batch = writeBatch(db);

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('groupId', '==', groupId));
    const usersSnapshot = await getDocs(q);
    usersSnapshot.forEach(userDoc => {
      batch.update(userDoc.ref, { groupId: null });
    });

    const groupDocRef = doc(db, 'groups', groupId);
    batch.delete(groupDocRef);

    await batch.commit();
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao deletar grupo.' };
  }
}

export async function getRecentSales(userId: string): Promise<RecentSale[]> {
  if (!userId) return [];
  if (!db) throw new Error("Firebase não está configurado.");

  const salesRef = collection(db, 'sales');
  const q = query(salesRef, where('userId', '==', userId), orderBy('saleDate', 'desc'), limit(10));
  const querySnapshot = await getDocs(q);

  const recentSalesPromises = querySnapshot.docs.map(async (saleDoc) => {
    const saleData = saleDoc.data();
    const clientDocRef = doc(db, 'clients', saleData.clientId);
    const clientDoc = await getDoc(clientDocRef);

    const clientName = clientDoc.exists() ? clientDoc.data().name : 'Cliente Desconhecido';

    return {
      id: saleDoc.id,
      clientId: saleData.clientId,
      clientName: clientName,
      saleDate: (saleData.saleDate as Timestamp).toDate().toISOString(),
      saleValue: saleData.saleValue || 0,
    } as RecentSale;
  });

  return Promise.all(recentSalesPromises);
}

export async function cancelSale(saleId: string, userId: string) {
  if (!userId) return { success: false, error: 'Usuário não autenticado.' };
  if (!db) return { success: false, error: "Firebase não está configurado." };

  const saleDocRef = doc(db, 'sales', saleId);
  const saleDoc = await getDoc(saleDocRef);

  if (!saleDoc.exists() || saleDoc.data().userId !== userId) {
    return { success: false, error: 'Venda não encontrada ou não pertence a você.' };
  }

  const clientId = saleDoc.data().clientId;

  try {
    const clientDocRef = doc(db, 'clients', clientId);
    const batch = writeBatch(db);
    
    batch.delete(saleDocRef);
    
    batch.update(clientDocRef, {
      status: 'Pós-venda',
      updatedAt: Timestamp.now()
    });

    await batch.commit();

    revalidatePath('/');
    revalidatePath('/admin/dashboard');

    const updatedClientDoc = await getDoc(clientDocRef);
    const clientData = updatedClientDoc.data();

    const updatedClient: Client = {
      id: updatedClientDoc.id,
      name: clientData?.name,
      city: clientData?.city,
      contact: clientData?.contact,
      normalizedContact: clientData?.normalizedContact,
      lastProductBought: clientData?.lastProductBought,
      desiredProduct: clientData?.desiredProduct,
      status: clientData?.status,
      remarketingReminder: clientData?.remarketingReminder,
      createdAt: (clientData?.createdAt as Timestamp).toDate().toISOString(),
      updatedAt: (clientData?.updatedAt as Timestamp).toDate().toISOString(),
      userId: clientData?.userId,
    };

    return { success: true, updatedClient: updatedClient };

  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao cancelar a venda.' };
  }
}

export async function checkContactExists(contact: string, currentUserId: string, currentClientId?: string) {
  if (!db) {
    return { status: 'error', message: 'Erro de conexão.' };
  }
  
  const normalizedContact = contact.replace(/\D/g, '');
  if (normalizedContact.length < 10) {
      return { status: 'idle', message: null };
  }

  const clientsRef = collection(db, 'clients');
  const q = query(clientsRef, where('normalizedContact', '==', normalizedContact), limit(1));
  
  try {
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { status: 'available', message: '✅ Contato disponível.' };
    }

    const existingClientDoc = querySnapshot.docs[0];
    const existingClientData = existingClientDoc.data();
    const ownerId = existingClientData.userId;
    
    if (currentClientId && existingClientDoc.id === currentClientId) {
      return { status: 'idle', message: null };
    }
    
    if (ownerId === currentUserId) {
        return { status: 'info', message: 'ℹ️ Este contato já está na sua carteira.' };
    }

    const thirtyDaysAgo = subDays(new Date(), 30);
    const updatedAtDate = (existingClientData.updatedAt as Timestamp).toDate();
    const ownerUserDocRef = doc(db, 'users', ownerId);
    const ownerUserDoc = await getDoc(ownerUserDocRef);
    const ownerName = ownerUserDoc.exists() ? ownerUserDoc.data().name : 'um vendedor';
    
    if (updatedAtDate < thirtyDaysAgo) {
         return { 
            status: 'warning', 
            message: `⚠️ Contato de ${ownerName}. Lead inativo, será transferido para você ao salvar.`
        };
    }
    
    return { 
        status: 'error', 
        message: `❌ Contato de ${ownerName}. Lead ativo e bloqueado.` 
    };

  } catch (e) {
    console.error("Error checking contact existence:", e);
    return { status: 'error', message: "Erro ao verificar contato." };
  }
}

// ======== Message Template Actions ========

const templateFormSchema = z.object({
  title: z.string().min(3, "O título deve ter pelo menos 3 caracteres."),
  content: z.string().min(10, "O conteúdo do template deve ter pelo menos 10 caracteres."),
});

export async function getMessageTemplates(userId: string): Promise<MessageTemplate[]> {
  if (!userId) return [];
  if (!db) throw new Error("Firebase não está configurado.");
  
  const templatesRef = collection(db, 'messageTemplates');
  const q = query(templatesRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
    } as MessageTemplate;
  });
}

export async function createMessageTemplate(data: unknown, adminId: string) {
  if (!db) return { success: false, error: "Firebase não configurado." };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado.' };
  }

  const result = templateFormSchema.safeParse(data);
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return { success: false, error: fieldErrors.title?.[0] || fieldErrors.content?.[0] || "Erro de validação." };
  }
  
  try {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, 'messageTemplates'), {
      ...result.data,
      adminId,
      createdAt: now,
    });
    revalidatePath('/admin/dashboard');

    const createdTemplate: MessageTemplate = {
      id: docRef.id,
      title: result.data.title,
      content: result.data.content,
      adminId,
      createdAt: now.toDate().toISOString(),
    };

    return { success: true, template: createdTemplate };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao criar template.' };
  }
}

export async function updateMessageTemplate(templateId: string, data: unknown, adminId: string) {
  if (!db) return { success: false, error: "Firebase não está configurado." };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado.' };
  }

  const result = templateFormSchema.safeParse(data);
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return { success: false, error: fieldErrors.title?.[0] || fieldErrors.content?.[0] || "Erro de validação." };
  }

  try {
    const templateDocRef = doc(db, 'messageTemplates', templateId);
    await updateDoc(templateDocRef, result.data);
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao atualizar template.' };
  }
}

export async function deleteMessageTemplate(templateId: string, adminId: string) {
  if (!db) return { success: false, error: "Firebase não está configurado." };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado.' };
  }

  try {
    await deleteDoc(doc(db, "messageTemplates", templateId));
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Erro ao deletar template." };
  }
}
