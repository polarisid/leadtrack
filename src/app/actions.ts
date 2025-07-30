

'use server';

import { revalidatePath } from 'next/cache';
import { Client, ClientStatus, clientStatuses, productCategories, Comment, UserProfile, UserStatus, DashboardAnalyticsData, SellerAnalytics, AnalyticsPeriod, Group, RecentSale, MessageTemplate, SellerPerformanceData, Goal, UserGoal, Tag, LeadAnalysisInput, LeadAnalysisOutput, DailySummaryOutput, AdminDailySummaryOutput, Offer, OfferSchema, OfferFormValues, OfferStatus, OfferTextGeneratorInput, OfferTextGeneratorOutput, ProposalTextGeneratorInput, ProposalTextGeneratorOutput, BrandingSettings, InstallationService } from '@/lib/types';
import { z } from 'zod';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, Timestamp, orderBy, writeBatch, getDoc, limit, collectionGroup, arrayRemove, runTransaction, arrayUnion, setDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { subDays, format, parseISO, startOfWeek, endOfWeek, subWeeks, isWithinInterval, startOfDay, endOfDay, startOfMonth, addDays, subHours, endOfMonth, subMonths, startOfYear, endOfYear, subYears, addMonths, isAfter, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { analyzeLead } from '@/ai/flows/lead-analysis-flow';
import { generateDailySummary } from '@/ai/flows/daily-summary-flow';
import { generateAdminDailySummary } from '@/ai/flows/admin-daily-summary-flow';
import { generateOfferShareText } from '@/ai/flows/offer-text-flow';


const formSchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
  city: z.string().min(2, "A cidade deve ter pelo menos 2 caracteres."),
  contact: z.string().min(5, "O contato parece muito curto."),
  lastProductBought: z.string().optional(),
  desiredProduct: z.enum(productCategories),
  status: z.enum(clientStatuses),
  remarketingReminder: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

const captureLeadSchema = z.object({
  name: z.string().min(2, "Seu nome deve ter pelo menos 2 caracteres."),
  city: z.string().min(2, "Sua cidade deve ter pelo menos 2 caracteres."),
  contact: z.string().min(10, "O contato com DDD deve ter pelo menos 10 dígitos."),
  desiredProduct: z.enum(productCategories),
  referredBy: z.string().optional(),
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
      tagIds: [],
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
            tagIds: result.data.tagIds || [],
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

export async function updateClientStatus(id: string, status: ClientStatus, userId: string, saleValue?: number, productInfo?: string) {
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

            let commentText = `Venda registrada no valor de ${saleValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`;
            if (productInfo) {
                commentText += `\nProduto(s) vendido(s): ${productInfo}`;
            }

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
        const clientDoc = await getDoc(clientDocRef);

        if (!clientDoc.exists()) {
            return { error: 'Cliente não encontrado.' };
        }

        const clientData = clientDoc.data();
        const batch = writeBatch(db);

        // Create an audit log for the deletion
        const auditLogRef = doc(collection(db, 'audit_logs'));
        batch.set(auditLogRef, {
            action: 'client_deleted',
            actorId: userId, // The user performing the action
            entityOwnerId: clientData.userId, // The owner of the lead
            entityId: id,
            timestamp: Timestamp.now(),
            details: {
                clientName: clientData.name,
                clientCity: clientData.city,
                clientContact: clientData.contact
            }
        });
        
        // Perform the actual deletion
        batch.delete(clientDocRef);
        
        await batch.commit();

        revalidatePath('/');
        revalidatePath('/admin/dashboard');
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
    return { success: false, error: 'Acesso permitida apenas para administradores.' };
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
    endOfCurrentPeriod = endOfDay(endOfWeek(now, { weekStartsOn: 1 }));
    startOfPreviousPeriod = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    endOfPreviousPeriod = endOfDay(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }));
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
  salesThisPeriod.forEach(sale => {
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

  const [usersSnapshot, allClientsSnapshot, allSalesSnapshot, auditLogsSnapshot] = await Promise.all([
    getDocs(usersQuery),
    getDocs(collection(db, 'clients')),
    getDocs(query(collection(db, 'sales'), orderBy('saleDate', 'asc'))),
    getDocs(query(collection(db, 'audit_logs'), where('action', '==', 'client_deleted')))
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
      clientFirstPurchase.add(sale.id);
    }
  });

  const deletedLeadsCountMap = new Map<string, number>();
  auditLogsSnapshot.forEach(logDoc => {
      const logData = logDoc.data();
      const ownerId = logData.entityOwnerId;
      if (ownerId) {
          deletedLeadsCountMap.set(ownerId, (deletedLeadsCountMap.get(ownerId) || 0) + 1);
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
        endDate = endOfDay(endOfWeek(now, { weekStartsOn: 1 }));
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
      totalDeletedLeads: deletedLeadsCountMap.get(seller.id) || 0,
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
    endOfCurrentPeriod = endOfDay(endOfWeek(now, { weekStartsOn: 1 }));
    startOfPreviousPeriod = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    endOfPreviousPeriod = endOfDay(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }));
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
  
  const [usersSnapshot, allClientsSnapshot, allSalesSnapshot, groupsSnapshot, userGoalsSnapshot, groupGoalsSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('role', '==', 'vendedor'))),
    getDocs(collection(db, 'clients')),
    getDocs(collection(db, 'sales')),
    getDocs(collection(db, 'groups')),
    getDocs(query(collection(db, 'userGoals'), where('period', '==', format(now, 'yyyy-MM')))),
    getDocs(query(collection(db, 'goals'), where('period', '==', format(now, 'yyyy-MM'))))
  ]);

  const allSellers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<UserProfile, 'id'>) }));
  const currentUser = allSellers.find(s => s.id === userId);
  const groupNameMap = new Map(groupsSnapshot.docs.map(doc => [doc.id, doc.data().name]));

  const allClients = allClientsSnapshot.docs.map(doc => ({ ...doc.data() as Omit<Client, 'createdAt'>, id: doc.id, createdAt: (doc.data().createdAt as Timestamp).toDate(), userId: doc.data().userId }));
  const allSales = allSalesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, saleDate: (doc.data().saleDate as Timestamp).toDate() }));

  const clientsThisPeriod = allClients.filter(c => isWithinInterval(c.createdAt, { start: startOfCurrentPeriod, end: endOfCurrentPeriod }));
  const salesThisPeriod = allSales.filter(s => isWithinInterval(s.saleDate, { start: startOfCurrentPeriod, end: endOfCurrentPeriod }));

  const clientsLastPeriod = allClients.filter(c => isWithinInterval(c.createdAt, { start: startOfPreviousPeriod, end: endOfCurrentPeriod }));
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

  const personalStats: SellerPerformanceData['personalStats'] = {
    revenue: { total: personalRevenueThis, change: calculateChange(personalRevenueThis, personalRevenueLast) },
    leads: { count: personalLeadsThis, change: calculateChange(personalLeadsThis, personalLeadsLast) },
    sales: { count: personalSalesCountThis, change: calculateChange(personalSalesCountThis, personalSalesCountLast) },
    conversionRate: { rate: personalConversionRateThis, change: calculateChange(personalConversionRateThis, personalConversionRateLast) },
    goal: null,
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

  // --- Goal Calculations (always for the current month) ---
  const startOfGoalPeriod = startOfMonth(now);
  const endOfGoalPeriod = endOfMonth(now);
  const salesForGoals = allSales.filter(s => isWithinInterval(s.saleDate, { start: startOfGoalPeriod, end: endOfGoalPeriod }));
  
  const userRevenueForGoals = new Map<string, number>();
  salesForGoals.forEach(sale => {
    const currentRevenue = userRevenueForGoals.get(sale.userId) || 0;
    userRevenueForGoals.set(sale.userId, currentRevenue + (sale.saleValue || 0));
  });

  const userGoalsMap = new Map<string, { targetValue: number }>();
  userGoalsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    userGoalsMap.set(data.userId, { targetValue: data.targetValue });
  });

  // Personal Goal
  const personalGoalData = userGoalsMap.get(userId);
  if (personalGoalData) {
    const target = personalGoalData.targetValue;
    const current = userRevenueForGoals.get(userId) || 0;
    
    // -- New Daily Goal Logic --
    const today = now; // Use the adjusted 'now'
    const endOfMonthDate = endOfGoalPeriod;
    let remainingBusinessDays = 0;
    let loopDate = today;

    while (loopDate <= endOfMonthDate) {
        const dayOfWeek = getDay(loopDate); // 0=Sun, 1=Mon, ..., 6=Sat
        if (dayOfWeek > 0 && dayOfWeek < 6) { // Monday to Friday
            remainingBusinessDays++;
        }
        loopDate = addDays(loopDate, 1);
    }
    
    const remainingValue = Math.max(0, target - current);
    const dailyTarget = remainingBusinessDays > 0 ? remainingValue / remainingBusinessDays : 0;
    // -- End New Logic --

    personalStats.goal = {
        target,
        current,
        progress: target > 0 ? (current / target) * 100 : 0,
        dailyTarget: dailyTarget,
        remainingDays: remainingBusinessDays,
    };
  }

  // Group Goal
  let groupGoal: SellerPerformanceData['groupGoal'] = null;
  if (currentUser?.groupId) {
      const groupGoalDoc = groupGoalsSnapshot.docs.find(doc => doc.data().groupId === currentUser.groupId);
      if (groupGoalDoc) {
          const groupGoalData = groupGoalDoc.data();
          let currentGroupRevenue = 0;
          allSellers
              .filter(s => s.groupId === currentUser.groupId)
              .forEach(member => {
                  currentGroupRevenue += userRevenueForGoals.get(member.id) || 0;
              });
          
          groupGoal = {
              target: groupGoalData.targetValue,
              current: currentGroupRevenue,
              progress: groupGoalData.targetValue > 0 ? (currentGroupRevenue / groupGoalData.targetValue) * 100 : 0,
          };
      }
  }

  // Goal Champions Ranking
  const goalChampionsRanking = allSellers
    .filter(seller => userGoalsMap.has(seller.id))
    .map(seller => {
        const goalData = userGoalsMap.get(seller.id)!;
        const currentRevenue = userRevenueForGoals.get(seller.id) || 0;
        const progress = goalData.targetValue > 0 ? (currentRevenue / goalData.targetValue) * 100 : 0;
        return {
            sellerId: seller.id,
            sellerName: seller.name,
            goalProgress: progress,
        };
    })
    .sort((a, b) => b.goalProgress - a.goalProgress);

  return {
    personalStats,
    generalRanking,
    groupRanking,
    groupName: currentUser?.groupId ? groupNameMap.get(currentUser.groupId) : undefined,
    period,
    goalChampionsRanking,
    groupGoal,
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
    slug: doc.data().slug,
    memberCount: groupCounts[doc.id] || 0,
  }));
}

const groupNameSchema = z.object({
    name: z.string().min(2, "O nome do grupo deve ter pelo menos 2 caracteres.")
});

// Helper function to create a URL-friendly slug
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD") // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, "") // Remove accent marks
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars except -
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

export async function createGroup(name: string, adminId: string) {
  if (!db) return { success: false, error: "Firebase não configurado." };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado.' };
  }

  const result = groupNameSchema.safeParse({ name });
  if (!result.success) {
    return { success: false, error: result.error.flatten().fieldErrors.name?.join(', ') };
  }

  const slug = createSlug(result.data.name);

  try {
    const groupsRef = collection(db, 'groups');
    const q = query(groupsRef, where('slug', '==', slug), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return { success: false, error: 'Um grupo com um nome similar já existe, o que criaria um link duplicado. Por favor, escolha um nome ligeiramente diferente.' };
    }

    const docRef = await addDoc(collection(db, 'groups'), {
      name,
      slug,
      adminId,
      createdAt: Timestamp.now(),
    });
    revalidatePath('/admin/dashboard');
    return { success: true, group: { id: docRef.id, name, slug } as Group };
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
  
  const slug = createSlug(result.data.name);

  try {
    const groupsRef = collection(db, 'groups');
    const q = query(groupsRef, where('slug', '==', slug), limit(1));
    const snapshot = await getDocs(q);
    const conflictingGroup = snapshot.docs.find(doc => doc.id !== groupId);
    if (conflictingGroup) {
        return { success: false, error: 'Um grupo com um nome similar já existe, o que criaria um link duplicado. Por favor, escolha um nome ligeiramente diferente.' };
    }

    const groupDocRef = doc(db, 'groups', groupId);
    await updateDoc(groupDocRef, { name, slug });
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao atualizar grupo.' };
  }
}

export async function deleteGroup(groupId: string, adminId: string) {
  if (!db) return { success: false, error: "Firebase não está configurado." };
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
      tagIds: clientData?.tagIds || []
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

// ======== Goals (Metas) Actions ========

export async function getGoals(adminId: string, period: string): Promise<Goal[]> {
    if (!db) throw new Error('Firebase não está configurado.');
    if (!await isAdmin(adminId)) throw new Error('Acesso negado.');

    const [groupsSnapshot, usersSnapshot, salesSnapshot] = await Promise.all([
      getDocs(collection(db, 'groups')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'sales'))
    ]);
    const groupMap = new Map(groupsSnapshot.docs.map(doc => [doc.id, doc.data().name]));
    const userMap = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data() as UserProfile]));

    const [year, month] = period.split('-').map(Number);
    const startDate = startOfMonth(new Date(year, month - 1, 1));
    const endDate = endOfMonth(startDate);

    const salesInPeriod = salesSnapshot.docs
        .map(doc => {
            const data = doc.data();
            return {
                ...data,
                saleDate: (data.saleDate as Timestamp).toDate()
            };
        })
        .filter(sale => isWithinInterval(sale.saleDate, { start: startDate, end: endDate }));
    
    const userSalesMap = new Map<string, number>();
    salesInPeriod.forEach(sale => {
        const currentSales = userSalesMap.get(sale.userId) || 0;
        userSalesMap.set(sale.userId, currentSales + sale.saleValue);
    });

    const goalsRef = collection(db, 'goals');
    const goalsQuery = query(goalsRef, where('adminId', '==', adminId), where('period', '==', period));
    const goalsSnapshot = await getDocs(goalsQuery);

    const goals: Goal[] = [];
    for (const goalDoc of goalsSnapshot.docs) {
        const goalData = goalDoc.data();
        const userGoalsRef = collection(db, 'userGoals');
        const userGoalsQuery = query(userGoalsRef, where('goalId', '==', goalDoc.id));
        const userGoalsSnapshot = await getDocs(userGoalsQuery);
        
        let totalCurrentValue = 0;
        const userGoals: UserGoal[] = userGoalsSnapshot.docs.map(ugDoc => {
            const ugData = ugDoc.data();
            const currentUser = userMap.get(ugData.userId);
            const currentValue = userSalesMap.get(ugData.userId) || 0;
            totalCurrentValue += currentValue;
            
            return {
                id: ugDoc.id,
                userId: ugData.userId,
                userName: currentUser?.name || 'Vendedor Deletado',
                goalId: ugData.goalId,
                targetValue: ugData.targetValue,
                currentValue,
                period: ugData.period,
            };
        });

        goals.push({
            id: goalDoc.id,
            groupId: goalData.groupId,
            groupName: groupMap.get(goalData.groupId) || 'Grupo Deletado',
            targetValue: goalData.targetValue,
            currentValue: totalCurrentValue,
            period: goalData.period,
            userGoals,
        });
    }
    
    return goals.sort((a,b) => a.groupName.localeCompare(b.groupName));
}

export async function createOrUpdateGroupGoal(data: { groupId: string; targetValue: number; period: string }, adminId: string) {
    if (!db) return { success: false, error: 'Firebase não está configurado.' };
    if (!await isAdmin(adminId)) return { success: false, error: 'Acesso negado.' };

    const { groupId, targetValue, period } = data;
    if (targetValue <= 0) return { success: false, error: 'O valor da meta deve ser positivo.' };

    const usersRef = collection(db, 'users');
    const groupUsersQuery = query(usersRef, where('groupId', '==', groupId));
    const groupUsersSnapshot = await getDocs(groupUsersQuery);
    const groupUsers = groupUsersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as UserProfile }));

    if (groupUsers.length === 0) {
        return { success: false, error: 'Este grupo não tem vendedores para definir uma meta.' };
    }

    const individualTarget = Math.floor((targetValue / groupUsers.length) * 100) / 100;

    const goalsRef = collection(db, 'goals');
    const existingGoalQuery = query(goalsRef, where('groupId', '==', groupId), where('period', '==', period), limit(1));
    const existingGoalSnapshot = await getDocs(existingGoalQuery);

    const batch = writeBatch(db);
    let goalId: string;
    const now = Timestamp.now();

    if (existingGoalSnapshot.empty) {
        const newGoalRef = doc(goalsRef);
        goalId = newGoalRef.id;
        batch.set(newGoalRef, { adminId, groupId, targetValue, period, createdAt: now });
    } else {
        const existingGoalRef = existingGoalSnapshot.docs[0].ref;
        goalId = existingGoalRef.id;
        batch.update(existingGoalRef, { targetValue });
    }

    const userGoalsRef = collection(db, 'userGoals');
    for (const user of groupUsers) {
        const userGoalQuery = query(userGoalsRef, where('goalId', '==', goalId), where('userId', '==', user.id), limit(1));
        const userGoalSnapshot = await getDocs(userGoalQuery);
        
        if (userGoalSnapshot.empty) {
            const newUserGoalRef = doc(userGoalsRef);
            batch.set(newUserGoalRef, { goalId, userId: user.id, period, targetValue: individualTarget, createdAt: now });
        } else {
            // Se a meta do grupo for atualizada, redistribui o valor igualmente.
            // A edição individual será uma ação separada.
            batch.update(userGoalSnapshot.docs[0].ref, { targetValue: individualTarget });
        }
    }

    try {
        await batch.commit();
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Erro ao salvar meta do grupo.' };
    }
}

export async function updateIndividualGoal(userGoalId: string, newTargetValue: number, adminId: string) {
    if (!db) return { success: false, error: 'Firebase não está configurado.' };
    if (!await isAdmin(adminId)) return { success: false, error: 'Acesso negado.' };

    if (typeof newTargetValue !== 'number' || newTargetValue < 0) {
        return { success: false, error: 'O valor da meta individual é inválido.' };
    }

    try {
        const userGoalRef = doc(db, 'userGoals', userGoalId);
        await updateDoc(userGoalRef, { targetValue: newTargetValue });
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Erro ao atualizar meta individual.' };
    }
}

export async function deleteGoal(goalId: string, adminId: string) {
    if (!db) return { success: false, error: 'Firebase não está configurado.' };
    if (!await isAdmin(adminId)) return { success: false, error: 'Acesso negado.' };

    try {
        const batch = writeBatch(db);
        const goalRef = doc(db, 'goals', goalId);
        batch.delete(goalRef);

        const userGoalsQuery = query(collectionGroup(db, 'userGoals'), where('goalId', '==', goalId));
        const userGoalsSnapshot = await getDocs(userGoalsQuery);
        userGoalsSnapshot.forEach(doc => batch.delete(doc.ref));

        await batch.commit();
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Erro ao deletar meta.' };
    }
}


// ======== Lead Capture Actions ========

export async function getGroupInfoBySlug(slug: string): Promise<Group | null> {
    if (!db) throw new Error("Firebase não está configurado.");
    const groupsRef = collection(db, 'groups');
    const q = query(groupsRef, where('slug', '==', slug), limit(1));
    const groupSnapshot = await getDocs(q);
    if (groupSnapshot.empty) return null;
    const groupDoc = groupSnapshot.docs[0];
    return { id: groupDoc.id, ...groupDoc.data() } as Group;
}

export async function captureLead(data: unknown, groupId: string) {
  if (!db) {
    return { success: false, error: "Firebase não está configurado." };
  }
  const result = captureLeadSchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: result.error.flatten().fieldErrors };
  }
  
  const { name, city, contact, desiredProduct, referredBy } = result.data;
  const normalizedContact = contact.replace(/\D/g, '');

  const clientsRef = collection(db, 'clients');
  const q = query(clientsRef, where('normalizedContact', '==', normalizedContact), limit(1));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    return { success: false, error: { contact: ["Este número de contato já está registrado."] } };
  }

  const groupDocRef = doc(db, 'groups', groupId);
  const groupDoc = await getDoc(groupDocRef);
  if (!groupDoc.exists()) {
    return { success: false, error: { form: ["Grupo de captação inválido."] } };
  }
  const groupName = groupDoc.data().name;

  try {
    const batch = writeBatch(db);
    const newClientRef = doc(clientsRef);
    const now = Timestamp.now();
    
    const newClientData = {
      name,
      city,
      contact,
      normalizedContact,
      desiredProduct,
      referredBy: referredBy || '',
      status: 'Novo Lead' as ClientStatus,
      lastProductBought: '',
      remarketingReminder: '',
      userId: null,
      groupId: groupId,
      createdAt: now,
      updatedAt: now,
      tagIds: [],
    };
    batch.set(newClientRef, newClientData);

    const commentText = `Lead capturado pela página do grupo "${groupName}".${referredBy ? ` Indicado por: ${referredBy}.` : ''}`;
    const commentsRef = collection(db, 'clients', newClientRef.id, 'comments');
    batch.set(doc(commentsRef), {
      text: commentText,
      userId: 'system',
      createdAt: now,
      isSystemMessage: true,
    });
    
    await batch.commit();
    revalidatePath('/');
    return { success: true };

  } catch (e: any) {
    return { success: false, error: { form: [e.message || 'Erro ao registrar lead.'] } };
  }
}

export async function getUnclaimedLeads(groupId: string): Promise<Client[]> {
  if (!groupId) return [];
  if (!db) throw new Error("Firebase não está configurado.");

  const clientsRef = collection(db, 'clients');
  // Query only by group to avoid needing a complex composite index.
  // Filtering and sorting for unclaimed leads will be done in the code.
  const q = query(clientsRef, where('groupId', '==', groupId));
  const querySnapshot = await getDocs(q);

  const allGroupClients = querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate().toISOString() : undefined,
    } as Client;
  });

  // Filter for unclaimed leads (where userId is null) and sort them
  const unclaimedLeads = allGroupClients
    .filter(client => client.userId === null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return unclaimedLeads;
}

export async function claimLead(clientId: string, userId: string, userName: string) {
  if (!userId) return { success: false, error: 'Usuário não autenticado.' };
  if (!db) return { success: false, error: "Firebase não está configurado." };
  
  const clientDocRef = doc(db, 'clients', clientId);
  
  try {
    const clientDoc = await getDoc(clientDocRef);
    if (!clientDoc.exists() || clientDoc.data()?.userId !== null) {
      return { success: false, error: 'Este lead já foi pego ou não existe mais.' };
    }

    const batch = writeBatch(db);
    const now = Timestamp.now();

    batch.update(clientDocRef, { 
      userId: userId,
      updatedAt: now,
    });

    const commentText = `Lead pego por ${userName}.`;
    const commentsRef = collection(db, 'clients', clientId, 'comments');
    batch.set(doc(commentsRef), {
      text: commentText,
      userId: 'system',
      createdAt: now,
      isSystemMessage: true,
    });
    
    await batch.commit();

    const updatedDoc = await getDoc(clientDocRef);
    const updatedClient = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: (updatedDoc.data()?.createdAt as Timestamp).toDate().toISOString(),
      updatedAt: (updatedDoc.data()?.updatedAt as Timestamp).toDate().toISOString(),
    } as Client

    revalidatePath('/');
    return { success: true, client: updatedClient };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao pegar o lead.' };
  }
}

// ======== Tag Actions ========

const tagFormSchema = z.object({
  name: z.string().min(2, "O nome da tag deve ter pelo menos 2 caracteres."),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "A cor deve ser um hexadecimal válido (ex: #RRGGBB)."),
});

export async function getTags(userId: string): Promise<Tag[]> {
  if (!userId) return [];
  if (!db) throw new Error("Firebase não está configurado.");
  
  const tagsRef = collection(db, 'tags');
  const q = query(tagsRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
    } as Tag;
  });
}

export async function createTag(data: unknown, adminId: string) {
  if (!db) return { success: false, error: "Firebase não configurado." };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado.' };
  }

  const result = tagFormSchema.safeParse(data);
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return { success: false, error: fieldErrors.name?.[0] || fieldErrors.color?.[0] || "Erro de validação." };
  }
  
  try {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, 'tags'), {
      ...result.data,
      adminId,
      createdAt: now,
    });
    revalidatePath('/admin/dashboard');

    return { success: true, tag: { id: docRef.id, ...result.data, adminId, createdAt: now.toDate().toISOString() } as Tag };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao criar tag.' };
  }
}

export async function updateTag(tagId: string, data: unknown, adminId: string) {
  if (!db) return { success: false, error: "Firebase não está configurado." };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado.' };
  }

  const result = tagFormSchema.safeParse(data);
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return { success: false, error: fieldErrors.name?.[0] || fieldErrors.color?.[0] || "Erro de validação." };
  }

  try {
    const tagDocRef = doc(db, 'tags', tagId);
    await updateDoc(tagDocRef, result.data);
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao atualizar tag.' };
  }
}

export async function deleteTag(tagId: string, adminId: string) {
  if (!db) return { success: false, error: "Firebase não está configurado." };
  if (!await isAdmin(adminId)) {
    return { success: false, error: 'Acesso negado.' };
  }
  
  try {
    await runTransaction(db, async (transaction) => {
      // 1. Delete the tag document
      const tagRef = doc(db, 'tags', tagId);
      transaction.delete(tagRef);
      
      // 2. Find all clients that have this tag
      const clientsRef = collection(db, 'clients');
      const q = query(clientsRef, where('tagIds', 'array-contains', tagId));
      const clientsSnapshot = await getDocs(q);

      // 3. Remove the tagId from each client's tagIds array
      clientsSnapshot.forEach(clientDoc => {
        transaction.update(clientDoc.ref, {
          tagIds: arrayRemove(tagId)
        });
      });
    });

    revalidatePath('/admin/dashboard');
    revalidatePath('/');
    return { success: true };
  } catch (e: any) {
    console.error("Error deleting tag and updating clients:", e);
    return { success: false, error: e.message || "Erro ao deletar tag." };
  }
}

export async function updateClientTags(clientId: string, tagIds: string[], userId: string) {
  if (!userId) {
    return { success: false, error: 'Usuário não autenticado.' };
  }
  if (!db) {
    return { success: false, error: "Firebase não está configurado." };
  }

  try {
    const clientRef = doc(db, 'clients', clientId);
    await updateDoc(clientRef, {
      tagIds: tagIds,
      updatedAt: Timestamp.now()
    });
    revalidatePath('/');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Erro ao atualizar as tags do cliente." };
  }
}

// AI Actions
export async function analyzeLeadAction(input: LeadAnalysisInput) {
    return await analyzeLead(input);
}

export async function saveLeadAnalysis(clientId: string, analysis: LeadAnalysisOutput) {
    if (!db) {
        return { success: false, error: "Firebase não está configurado." };
    }
    try {
        const clientRef = doc(db, 'clients', clientId);
        await updateDoc(clientRef, {
            lastAnalysis: analysis
        });
        
        const updatedDoc = await getDoc(clientRef);
        const updatedClient = {
            id: updatedDoc.id,
            ...updatedDoc.data(),
            createdAt: (updatedDoc.data()?.createdAt as Timestamp).toDate().toISOString(),
            updatedAt: (updatedDoc.data()?.updatedAt as Timestamp).toDate().toISOString(),
        } as Client;

        revalidatePath('/');
        return { success: true, updatedClient };
    } catch (e: any) {
        return { success: false, error: e.message || "Erro ao salvar análise." };
    }
}

export async function getDailySummaryAction(userId: string): Promise<{ success: boolean; summary?: DailySummaryOutput; error?: string }> {
    if (!userId) return { success: false, error: "User not authenticated." };
    if (!db) return { success: false, error: "Firebase not configured." };

    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            return { success: false, error: "User not found." };
        }

        const allClients = await getClients(userId);

        if (allClients.length === 0) {
            return { success: false, error: "No clients to analyze." };
        }

        const clientsForAnalysis = allClients.map(c => ({
            name: c.name,
            status: c.status,
            desiredProduct: c.desiredProduct,
            updatedAt: c.updatedAt || c.createdAt,
        }));

        const summary = await generateDailySummary({ clients: clientsForAnalysis });

        await updateDoc(userRef, {
            dailySummary: {
                date: format(new Date(), 'yyyy-MM-dd'),
                summary: summary,
            },
        });

        revalidatePath('/');
        return { success: true, summary: summary };

    } catch (e: any) {
        return { success: false, error: e.message || "Failed to generate daily summary." };
    }
}

export async function getAdminDailySummaryAction(adminId: string): Promise<{ success: boolean; summary?: AdminDailySummaryOutput; error?: string }> {
    if (!adminId || !db) return { success: false, error: "Not authenticated or DB not configured." };
    if (!await isAdmin(adminId)) return { success: false, error: "Access denied." };

    try {
        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, where('role', '==', 'vendedor'));
        const usersSnapshot = await getDocs(usersQuery);

        if (usersSnapshot.empty) {
            return { success: false, error: "No sellers found to analyze." };
        }

        const allSellers = usersSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));

        const allClientsSnapshot = await getDocs(collection(db, 'clients'));
        const allClientsData = allClientsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                createdAt: (data.createdAt as Timestamp).toDate(),
                updatedAt: (data.updatedAt as Timestamp).toDate(),
            } as Client;
        });

        const sellersData = allSellers.map(seller => {
            const sellerClients = allClientsData
                .filter(client => client.userId === seller.id)
                .map(client => ({
                    status: client.status,
                    updatedAt: (client.updatedAt || client.createdAt).toISOString(),
                }));

            return {
                sellerName: seller.name,
                clients: sellerClients,
            };
        });

        const summary = await generateAdminDailySummary({ sellers: sellersData });
        
        revalidatePath('/admin/dashboard');
        return { success: true, summary: summary };

    } catch (e: any) {
        return { success: false, error: e.message || "Failed to generate admin daily summary." };
    }
}

// ======== Offer Actions ========

export async function createOffer(data: OfferFormValues, userId: string, userName: string, isAdminCreation: boolean = false) {
  if (!db) return { success: false, error: "Firebase não está configurado." };
  
  try {
    const now = Timestamp.now();
    const newOfferData = {
      ...data,
      createdBy: userId,
      createdByName: userName,
      createdAt: now,
      status: isAdminCreation ? 'approved' : ('pending' as OfferStatus),
      likedBy: [],
      validUntil: Timestamp.fromDate(data.validUntil),
    };
    
    const docRef = await addDoc(collection(db, 'offers'), newOfferData);
    
    revalidatePath('/');
    revalidatePath('/admin/dashboard');

    const createdDoc = await getDoc(docRef);
    const createdData = createdDoc.data();

    return { 
      success: true, 
      offer: { 
        id: docRef.id, 
        ...createdData,
        validUntil: (createdData?.validUntil as Timestamp).toDate().toISOString(),
        createdAt: (createdData?.createdAt as Timestamp).toDate().toISOString(),
      } as Offer 
    };

  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao criar oferta.' };
  }
}

export async function updateOffer(offerId: string, data: OfferFormValues, adminId: string) {
  if (!db || !await isAdmin(adminId)) return { success: false, error: 'Acesso negado.' };

  try {
    const offerRef = doc(db, 'offers', offerId);
    const offerToUpdate = {
        ...data,
        validUntil: Timestamp.fromDate(data.validUntil),
    };
    await updateDoc(offerRef, offerToUpdate);

    revalidatePath('/');
    revalidatePath('/admin/dashboard');
    
    const updatedDoc = await getDoc(offerRef);
    const updatedData = updatedDoc.data();

    return { 
        success: true, 
        offer: {
            id: offerRef.id,
            ...updatedData,
            validUntil: (updatedData?.validUntil as Timestamp).toDate().toISOString(),
            createdAt: (updatedData?.createdAt as Timestamp).toDate().toISOString(),
        } as Offer
    };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao atualizar oferta.' };
  }
}


export async function getOffers(): Promise<Offer[]> {
  if (!db) throw new Error("Firebase não está configurado.");
  
  const offersRef = collection(db, 'offers');
  const q = query(offersRef, where('status', '==', 'approved'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      validUntil: (data.validUntil as Timestamp).toDate().toISOString(),
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
    } as Offer;
  });
}

export async function getAllOffersForAdmin(adminId: string): Promise<Offer[]> {
  if (!db || !await isAdmin(adminId)) return [];

  const offersRef = collection(db, 'offers');
  const q = query(offersRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      validUntil: (data.validUntil as Timestamp).toDate().toISOString(),
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
    } as Offer;
  });
}

export async function updateOfferStatus(offerId: string, status: OfferStatus, adminId: string) {
  if (!db || !await isAdmin(adminId)) return { success: false, error: 'Acesso negado.' };

  try {
    await updateDoc(doc(db, 'offers', offerId), { status });
    revalidatePath('/');
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao atualizar status da oferta.' };
  }
}

export async function deleteOffer(offerId: string, adminId: string) {
  if (!db || !await isAdmin(adminId)) return { success: false, error: 'Acesso negado.' };

  try {
    await deleteDoc(doc(db, 'offers', offerId));
    revalidatePath('/');
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao deletar oferta.' };
  }
}

export async function toggleOfferLike(offerId: string, userId: string) {
  if (!db || !userId) return { success: false, error: 'Acesso negado.' };
  
  const offerRef = doc(db, 'offers', offerId);

  try {
    const offerDoc = await getDoc(offerRef);
    if (!offerDoc.exists()) {
      return { success: false, error: 'Oferta não encontrada.' };
    }

    const likedBy: string[] = offerDoc.data().likedBy || [];
    let updatedLikedBy: string[];

    if (likedBy.includes(userId)) {
      // User has already liked, so unlike
      updatedLikedBy = likedBy.filter(id => id !== userId);
    } else {
      // User has not liked, so like
      updatedLikedBy = [...likedBy, userId];
    }
    
    await updateDoc(offerRef, { likedBy: updatedLikedBy });
    
    revalidatePath('/');

    return { success: true, likedBy: updatedLikedBy };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erro ao curtir oferta.' };
  }
}


export async function generateOfferShareTextAction(input: OfferTextGeneratorInput): Promise<OfferTextGeneratorOutput> {
    return await generateOfferShareText(input);
}

// ======== Branding & Service Actions ========

export async function getBrandingSettings() {
    if (!db) return null;
    
    try {
        const settingsRef = doc(db, 'settings', 'branding');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
            return docSnap.data() as BrandingSettings;
        }
        return null;
    } catch (e: any) {
        console.error("Error fetching branding settings:", e.message);
        return null;
    }
}

export async function updateBrandingSettings(adminId: string, settings: BrandingSettings) {
    if (!db) return { success: false, error: 'Firebase não está configurado.' };
    if (!await isAdmin(adminId)) {
        return { success: false, error: 'Acesso negado.' };
    }

    try {
        const settingsRef = doc(db, 'settings', 'branding');
        await setDoc(settingsRef, settings, { merge: true });
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Erro ao salvar configurações de marca.' };
    }
}

const serviceFormSchema = z.object({
  name: z.string().min(3, "O nome do serviço deve ter pelo menos 3 caracteres."),
  price: z.number().min(0, "O valor não pode ser negativo."),
  termsUrl: z.string().url("A URL dos termos é inválida.").optional().or(z.literal('')),
});
export type ServiceFormValues = z.infer<typeof serviceFormSchema>;

export async function getInstallationServices(): Promise<InstallationService[]> {
    if (!db) return [];
    const servicesRef = collection(db, 'installationServices');
    const q = query(servicesRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        } as InstallationService
    });
}

export async function createInstallationService(data: ServiceFormValues, adminId: string) {
    if (!db || !await isAdmin(adminId)) return { success: false, error: 'Acesso negado.' };
    
    try {
        const docRef = await addDoc(collection(db, 'installationServices'), {
            ...data,
            adminId,
            createdAt: Timestamp.now(),
        });
        revalidatePath('/admin/dashboard');
        const newServiceDoc = await getDoc(docRef);
        const newServiceData = newServiceDoc.data();
        return { 
            success: true, 
            service: { 
                id: docRef.id, 
                ...newServiceData,
                createdAt: (newServiceData?.createdAt as Timestamp).toDate().toISOString(),
            } as InstallationService 
        };
    } catch (e: any) {
        return { success: false, error: e.message || 'Erro ao criar serviço.' };
    }
}

export async function updateInstallationService(serviceId: string, data: ServiceFormValues, adminId: string) {
    if (!db || !await isAdmin(adminId)) return { success: false, error: 'Acesso negado.' };
    try {
        await updateDoc(doc(db, 'installationServices', serviceId), data);
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Erro ao atualizar serviço.' };
    }
}

export async function deleteInstallationService(serviceId: string, adminId: string) {
    if (!db || !await isAdmin(adminId)) return { success: false, error: 'Acesso negado.' };
    try {
        await deleteDoc(doc(db, 'installationServices', serviceId));
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Erro ao deletar serviço.' };
    }
}
